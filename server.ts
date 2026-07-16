import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

// Lazy getter for GoogleGenAI client to prevent crashes if key is missing during container build
let aiClient: GoogleGenAI | null = null;

function getAiClient(): GoogleGenAI {
  if (aiClient) return aiClient;

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set in the environment. Please configure it in your Settings > Secrets.");
  }

  aiClient = new GoogleGenAI({
    apiKey: apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });

  return aiClient;
}

// Custom direct fetch helper to bypass Google Auth SDK's automatic Application Default Credentials (ADC)
// discovery inside Cloud Run, preventing ACCESS_TOKEN_TYPE_UNSUPPORTED errors.
async function generateContentServer({
  image,
  mimeType,
  systemInstruction,
  prompt,
  schema,
  history,
  apiKey,
}: {
  image: string;
  mimeType: string;
  systemInstruction: string;
  prompt: string;
  schema?: any;
  history?: any[];
  apiKey?: string;
}): Promise<string> {
  const finalApiKey = apiKey || process.env.GEMINI_API_KEY;
  if (!finalApiKey) {
    throw new Error("GEMINI_API_KEY environment variable is required.");
  }

  // Strip base64 prefix if present
  const cleanBase64 = image.includes(";base64,") ? image.split(";base64,")[1] : image;
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${finalApiKey}`;

  const imagePart = {
    inlineData: {
      mimeType: mimeType,
      data: cleanBase64,
    },
  };

  const contents: any[] = [];
  if (history && Array.isArray(history)) {
    for (const turn of history) {
      contents.push({
        role: turn.role === "user" ? "user" : "model",
        parts: [{ text: turn.text }],
      });
    }
  }

  // Add current image and query
  contents.push({
    role: "user",
    parts: [imagePart, { text: prompt }],
  });

  const payload: any = {
    contents,
    systemInstruction: {
      parts: [
        {
          text: systemInstruction,
        },
      ],
    },
  };

  if (schema) {
    payload.generationConfig = {
      responseMimeType: "application/json",
      responseSchema: schema,
    };
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "aistudio-build",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    let parsedErr;
    try {
      parsedErr = JSON.parse(errorText);
    } catch (e) {}
    const geminiMessage = parsedErr?.error?.message || errorText;
    throw new Error(`Gemini Server API Call Failed (${response.status}): ${geminiMessage}`);
  }

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error("Empty response from Gemini server API.");
  }

  return text;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Configure Express with larger body limits for base64 image uploads
  app.use(express.json({ limit: "15mb" }));
  app.use(express.urlencoded({ limit: "15mb", extended: true }));

  // API Endpoint: Health Check
  app.get("/api/health", (req, res) => {
    res.json({ status: "healthy" });
  });

  // API Endpoint: Quickly Validate Form/Document Type from low-resolution thumbnail (Tiered Processing)
  app.post(["/api/validate-form-type", "/api/validate-form-type/"], async (req: express.Request, res: express.Response): Promise<void> => {
    try {
      const { image, mimeType, serviceType } = req.body;

      if (!image || !mimeType || !serviceType) {
        res.status(400).json({ error: "Missing required fields: image, mimeType, or serviceType" });
        return;
      }

            // Check if API Key is configured
      const clientApiKey = (req.headers["x-api-key"] as string) || (req.headers["authorization"] as string)?.replace("Bearer ", "") || "";
      const finalApiKey = clientApiKey || process.env.GEMINI_API_KEY;
      if (!finalApiKey) {
        res.status(500).json({
          error: "GEMINI_API_KEY is not configured on the server. Please add your Gemini API Key in the Secrets panel in AI Studio Settings or configure it in the API Setup modal."
        });
        return;
      }

      const systemInstruction = `You are "Form-Fixer Validator", a high-performance document classifier.
Analyze the provided low-resolution thumbnail image and determine if the document matches or is valid for the user's selected government service: "${serviceType}".

Evaluation criteria:
- Return isValid as true if the document type matches or is a plausible/acceptable form/document for the requested service (e.g., passport page/form for passport, Aadhaar card/enrollment form for Aadhaar, etc.).
- Return isValid as false if the uploaded image is a completely different document (e.g. uploading a birth certificate when "PAN Card Application" was chosen), or if it's a completely non-document photo (e.g. scenic landscape, random selfie, animal, object, food, or totally blank/corrupted image).

You must respond in the specified JSON schema.`;

      const responseText = await generateContentServer({
        image,
        mimeType,
        systemInstruction,
        prompt: `Pre-validate if this thumbnail is a valid document/form for "${serviceType}".`,
        apiKey: finalApiKey,
        schema: {
          type: "OBJECT",
          properties: {
            isValid: {
              type: "BOOLEAN",
              description: "True if the document in the thumbnail matches the expected service type, false otherwise."
            },
            documentType: {
              type: "STRING",
              description: "Identified document type name in English (e.g., 'Aadhaar Enrollment Form', 'PAN Card Form 49A', 'Incorrect Document/Photo')."
            },
            documentTypeEn: {
              type: "STRING",
              description: "Identified document type name in English (e.g., 'Aadhaar Enrollment Form', 'PAN Card Form 49A')."
            },
            documentTypeHi: {
              type: "STRING",
              description: "Identified document type name in Hindi (e.g., 'आधार नामांकन फॉर्म', 'पैन कार्ड फॉर्म 49A')."
            },
            reason: {
              type: "STRING",
              description: "Brief explanation in English why it is valid or invalid."
            },
            reasonHi: {
              type: "STRING",
              description: "Brief explanation in Hindi why it is valid or invalid."
            }
          },
          required: ["isValid", "documentType", "documentTypeEn", "documentTypeHi", "reason", "reasonHi"]
        }
      });

      let cleanedText = responseText.trim();
      if (cleanedText.startsWith("```")) {
        cleanedText = cleanedText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
      }
      cleanedText = cleanedText.trim();

      const parsedAnalysis = JSON.parse(cleanedText);
      res.json(parsedAnalysis);

    } catch (error: any) {
      console.error("Error in document pre-validation:", error);
      res.status(500).json({
        error: "Failed to pre-validate document.",
        details: error.message || error
      });
    }
  });

  // API Endpoint: Analyze Document/Form using Gemini 3.5 Flash
  app.post(["/api/analyze-form", "/api/analyze-form/"], async (req: express.Request, res: express.Response): Promise<void> => {
    try {
      const { image, mimeType, serviceType } = req.body;

      if (!image || !mimeType || !serviceType) {
        res.status(400).json({ error: "Missing required fields: image, mimeType, or serviceType" });
        return;
      }

      // Check if API Key is configured
      const clientApiKey = (req.headers["x-api-key"] as string) || (req.headers["authorization"] as string)?.replace("Bearer ", "") || "";
      const finalApiKey = clientApiKey || process.env.GEMINI_API_KEY;
      if (!finalApiKey) {
        res.status(500).json({
          error: "GEMINI_API_KEY is not configured on the server. Please add your Gemini API Key in the Secrets panel in AI Studio Settings or configure it in the API Setup modal."
        });
        return;
      }

      // Setup Gemini parameters and prompt
      const systemInstruction = `You are "Form-Fixer", an expert civic assistant and document validator designed to help citizens of India/Bharat successfully apply for government services.
Your role is to analyze images of uploaded government forms or supporting identity documents (e.g., Aadhaar Card, PAN Card, Driving License, Passport, Ration Card).

You must evaluate the document image against the rules for the selected government service: "${serviceType}".

Follow these strict visual inspection rules:
1. Identify the document type in the image. Check if it matches the selected service or if it is a completely wrong document (e.g. uploading a utility bill or ration card for driving license). If it is a completely incorrect or unrelated document type, set documentStatus to "INVALID_DOCUMENT".
2. Check for completeness of the form or document:
   - Are essential fields blank? (e.g., Address, Date of Birth, Name, Father's Name, Signature block)
   - Is a signature or thumbprint missing in the designated signature box/line?
   - Is the user photo missing, blurred, or obscured?
   - For identity cards (Aadhaar, PAN), check if the layout is correct and details look valid.
3. CRITICAL DATA PRIVACY RULE: You must detect sensitive numbers (like 12-digit Aadhaar card numbers, 10-character PAN numbers, bank account numbers, or full phone numbers).
   - You MUST redact them in your analysis! Do not output any real sensitive numbers in full.
   - For any detected sensitive data, mask it (e.g., "XXXX-XXXX-1234" for Aadhaar, or "XXXXX5432X" for PAN).
   - Log this in the "redactedData" list of your JSON response to prove to the user that their data was successfully masked and protected for safety.
4. Formulate actionable steps:
   - Provide clear, supportive, and polite instructions on how to correct any issues.
   - You MUST write these instructions in both English (titleEn, descriptionEn) and Hindi (titleHi, descriptionHi) to ensure maximum accessibility for Indian citizens.
5. Provide a warm, encouraging closing message in both languages (encouragementEn and encouragementHi). Always maintain a helpful, welcoming civic service tone.

Ensure the final output is 100% compliant with the provided JSON response schema.`;

      const responseText = await generateContentServer({
        image,
        mimeType,
        systemInstruction,
        prompt: `Analyze this uploaded document/form for the government service "${serviceType}". Please review it carefully, perform validation, redact sensitive credentials, and produce the detailed analysis.`,
        apiKey: finalApiKey,
        schema: {
          type: "OBJECT",
          properties: {
            documentType: {
              type: "STRING",
              description: "Name/type of the document identified in the image in English, e.g., 'Driving License Application Form 4', 'Aadhaar Card Update Form'."
            },
            documentTypeEn: {
              type: "STRING",
              description: "Name/type of the document identified in the image in English, e.g., 'Driving License Application Form 4'."
            },
            documentTypeHi: {
              type: "STRING",
              description: "Name/type of the document identified in the image in Hindi, e.g., 'ड्राइविंग लाइसेंस आवेदन पत्र (फॉर्म 4)'."
            },
            documentStatus: {
              type: "STRING",
              description: "Must be one of: 'COMPLETE', 'NEEDS_ATTENTION', 'INVALID_DOCUMENT'."
            },
            identifiedService: {
              type: "STRING",
              description: "Confirmed government service or application category in English."
            },
            identifiedServiceEn: {
              type: "STRING",
              description: "Confirmed government service or application category in English."
            },
            identifiedServiceHi: {
              type: "STRING",
              description: "Confirmed government service or application category in Hindi."
            },
            detectedFields: {
              type: "ARRAY",
              items: {
                type: "OBJECT",
                properties: {
                  name: { type: "STRING", description: "Name of the field in English (e.g., 'Applicant Signature', 'Permanent Address', 'Photograph')." },
                  nameEn: { type: "STRING", description: "Name of the field in English (e.g., 'Applicant Signature', 'Permanent Address', 'Photograph')." },
                  nameHi: { type: "STRING", description: "Name of the field in Hindi (e.g., 'आवेदक के हस्ताक्षर', 'स्थायी पता', 'फोटो')." },
                  status: { type: "STRING", description: "Status: 'FILLED', 'MISSING', or 'INCORRECT'." },
                  details: { type: "STRING", description: "Detailed check explanation in English, e.g., 'Found signature in the right-bottom box' or 'Address line 2 is blank'." },
                  detailsEn: { type: "STRING", description: "Detailed check explanation in English, e.g., 'Found signature in the right-bottom box' or 'Address line 2 is blank'." },
                  detailsHi: { type: "STRING", description: "Detailed check explanation in Hindi, e.g., 'दाहिनी-निचली बॉक्स में हस्ताक्षर मिले' या 'पता पंक्ति 2 खाली है'." }
                },
                required: ["name", "nameEn", "nameHi", "status", "details", "detailsEn", "detailsHi"]
              }
            },
            requiredSteps: {
              type: "ARRAY",
              items: {
                type: "OBJECT",
                properties: {
                  stepNumber: { type: "INTEGER", description: "Order sequence of the step." },
                  titleEn: { type: "STRING", description: "Action step title in English, e.g., 'Sign the Applicant Declaration box'." },
                  titleHi: { type: "STRING", description: "Action step title in Hindi, e.g., 'आवेदक घोषणा पत्र पर हस्ताक्षर करें' " },
                  descriptionEn: { type: "STRING", description: "Detailed guide in English." },
                  descriptionHi: { type: "STRING", description: "Detailed guide in Hindi." }
                },
                required: ["stepNumber", "titleEn", "titleHi", "descriptionEn", "descriptionHi"]
              }
            },
            redactedData: {
              type: "ARRAY",
              items: {
                type: "OBJECT",
                properties: {
                  type: { type: "STRING", description: "Category of personal data in English, e.g., 'Aadhaar Card Number', 'PAN number', 'Phone Number'." },
                  typeEn: { type: "STRING", description: "Category of personal data in English, e.g., 'Aadhaar Card Number'." },
                  typeHi: { type: "STRING", description: "Category of personal data in Hindi, e.g., 'आधार कार्ड संख्या'." },
                  originalDetected: { type: "STRING", description: "Redacted representation of the detected text, e.g., 'XXXX-XXXX-9876'." },
                  actionTaken: { type: "STRING", description: "Privacy action taken in English, e.g., 'Masked the first 8 digits for compliance with Aadhaar Act Section 32'." },
                  actionTakenEn: { type: "STRING", description: "Privacy action taken in English, e.g., 'Masked the first 8 digits for compliance with Aadhaar Act Section 32'." },
                  actionTakenHi: { type: "STRING", description: "Privacy action taken in Hindi, e.g., 'आधार अधिनियम की धारा 32 के अनुपालन के लिए पहले 8 अंकों को छुपाया गया'." }
                },
                required: ["type", "typeEn", "typeHi", "originalDetected", "actionTaken", "actionTakenEn", "actionTakenHi"]
              }
            },
            encouragementEn: { type: "STRING", description: "Polite, supportive encouragement in English, e.g., 'You are almost there! Just fill in the address and sign, and your application is ready to submit.'" },
            encouragementHi: { type: "STRING", description: "Polite, supportive encouragement in Hindi." }
          },
          required: [
            "documentType",
            "documentTypeEn",
            "documentTypeHi",
            "documentStatus",
            "identifiedService",
            "identifiedServiceEn",
            "identifiedServiceHi",
            "detectedFields",
            "requiredSteps",
            "redactedData",
            "encouragementEn",
            "encouragementHi"
          ]
        }
      });

      // Sanitize JSON by removing potential markdown wrapping blocks
      let cleanedText = responseText.trim();
      if (cleanedText.startsWith("```")) {
        cleanedText = cleanedText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
      }
      cleanedText = cleanedText.trim();

      // Parse the JSON response safely
      const parsedAnalysis = JSON.parse(cleanedText);
      res.json(parsedAnalysis);

    } catch (error: any) {
      console.error("Error analyzing form:", error);
      res.status(500).json({
        error: "Failed to analyze document. Please check the quality of your image and ensure it contains text.",
        details: error.message || error
      });
    }
  });

  // API Endpoint: Document Q&A Chat
  app.post(["/api/chat-document", "/api/chat-document/"], async (req: express.Request, res: express.Response): Promise<void> => {
    try {
      const { image, mimeType, serviceType, message, history } = req.body;

      if (!image || !mimeType || !serviceType || !message) {
        res.status(400).json({ error: "Missing required fields: image, mimeType, serviceType, or message" });
        return;
      }

      // Check if API Key is configured
      const clientApiKey = (req.headers["x-api-key"] as string) || (req.headers["authorization"] as string)?.replace("Bearer ", "") || "";
      const finalApiKey = clientApiKey || process.env.GEMINI_API_KEY;
      if (!finalApiKey) {
        res.status(500).json({
          error: "GEMINI_API_KEY is not configured on the server. Please add your Gemini API Key in the Secrets panel in AI Studio Settings or configure it in the API Setup modal."
        });
        return;
      }

      const systemInstruction = `You are "Form-Fixer AI", an expert Indian civic guide and document assistant.
The user is asking questions about an uploaded form/document for the government service "${serviceType}".
You must help them correct their document, explain civic rules (like UIDAI Aadhaar guidelines, RTO vehicle classes, Ministry of External Affairs passport requirements), and guide them through filling forms, signature requirements, official seals, or proof documents.

When answering:
1. Always maintain a highly supportive, friendly, and empowering tone.
2. Answer in the same language the user asks (e.g., if they ask in Hindi/Hinglish, answer in Hindi/Hinglish; if English, answer in English).
3. Do not output any real sensitive numbers from the document (like 12-digit Aadhaar numbers or 10-char PAN numbers). Mask them if you refer to them.
4. Give specific, precise advice based on the selected service guidelines. If they ask where to sign, point them to the designated signature boxes.
5. Keep answers highly readable, scannable, and clear. Use standard Markdown for bullet points and bolding.`;

      const responseText = await generateContentServer({
        image,
        mimeType,
        systemInstruction,
        prompt: message,
        history: history,
        apiKey: finalApiKey,
      });

      const finalResponseText = responseText || "I was unable to analyze your query. Please try again.";
      res.json({ text: finalResponseText });

    } catch (error: any) {
      console.error("Error in Q&A chat:", error);
      res.status(500).json({
        error: "Failed to process chat message.",
        details: error.message || error
      });
    }
  });

  // Catch-all for any other API routes to prevent falling back to HTML (SPA routing)
  app.all("/api/*", (req: express.Request, res: express.Response) => {
    res.status(404).json({
      error: `API route not found or method not allowed: ${req.method} ${req.path}`,
      details: "Please verify that the request method is POST and that the URL path is exactly correct."
    });
  });

  // Vite development server middleware setup
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    console.log("Vite development middleware mounted successfully.");
  } else {
    // Production static files setup
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
    console.log("Serving static production assets from:", distPath);
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Express Server running on port ${PORT} in ${process.env.NODE_ENV || "development"} mode.`);
  });
}

startServer().catch((err) => {
  console.error("Critical: Failed to start server:", err);
});
