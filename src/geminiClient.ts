// Client-side Gemini fallback for static host deployments (e.g. Netlify)

// 1. Validation Schema for raw Gemini API call
export const validateFormTypeSchema = {
  type: "OBJECT",
  properties: {
    isValid: {
      type: "BOOLEAN",
      description: "True if the document in the thumbnail matches the expected service type, false otherwise."
    },
    documentType: {
      type: "STRING",
      description: "Identified document type name (e.g., 'Aadhaar Enrollment Form', 'PAN Card Form 49A', 'Incorrect Document/Photo')."
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
  required: ["isValid", "documentType", "reason", "reasonHi"]
};

// 2. Full analysis Schema for raw Gemini API call
export const analyzeFormSchema = {
  type: "OBJECT",
  properties: {
    documentType: {
      type: "STRING",
      description: "Name/type of the document identified in the image, e.g., 'Driving License Application Form 4', 'Aadhaar Card Update Form'."
    },
    documentStatus: {
      type: "STRING",
      description: "Must be one of: 'COMPLETE', 'NEEDS_ATTENTION', 'INVALID_DOCUMENT'."
    },
    identifiedService: {
      type: "STRING",
      description: "Confirmed government service or application category."
    },
    detectedFields: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          name: { type: "STRING", description: "Name of the field (e.g., 'Applicant Signature', 'Permanent Address', 'Photograph')." },
          status: { type: "STRING", description: "Status: 'FILLED', 'MISSING', or 'INCORRECT'." },
          details: { type: "STRING", description: "Detailed check explanation, e.g., 'Found signature in the right-bottom box' or 'Address line 2 is blank'." }
        },
        required: ["name", "status", "details"]
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
          type: { type: "STRING", description: "Category of personal data (e.g., 'Aadhaar Card Number', 'PAN number', 'Phone Number')." },
          originalDetected: { type: "STRING", description: "Redacted representation of the detected text, e.g., 'XXXX-XXXX-9876'." },
          actionTaken: { type: "STRING", description: "Privacy action taken, e.g., 'Masked the first 8 digits for compliance with Aadhaar Act Section 32'." }
        },
        required: ["type", "originalDetected", "actionTaken"]
      }
    },
    encouragementEn: { type: "STRING", description: "Polite, supportive encouragement in English, e.g., 'You are almost there! Just fill in the address and sign, and your application is ready to submit.'" },
    encouragementHi: { type: "STRING", description: "Polite, supportive encouragement in Hindi." }
  },
  required: [
    "documentType",
    "documentStatus",
    "identifiedService",
    "detectedFields",
    "requiredSteps",
    "redactedData",
    "encouragementEn",
    "encouragementHi"
  ]
};

// Generic Client Direct API Call Helper
export const generateContentClient = async (
  image: string,
  mimeType: string,
  systemInstruction: string,
  prompt: string,
  schema?: any
) => {
  // Try to get key from VITE env var, then fallback to localstorage
  const apiKey = (import.meta.env.VITE_GEMINI_API_KEY as string) || localStorage.getItem('VITE_GEMINI_API_KEY');
  if (!apiKey) {
    throw new Error(
      "Static Host (Netlify) Detected: Direct client-side Gemini verification is active, but your VITE_GEMINI_API_KEY environment variable is not configured. Please configure the 'VITE_GEMINI_API_KEY' environment variable in your Netlify dashboard (Build & Deploy > Environment Variables) and trigger a redeploy. (For testing, you can also set the VITE_GEMINI_API_KEY in your local .env file or save it temporarily in localStorage as VITE_GEMINI_API_KEY!)"
    );
  }

  const cleanBase64 = image.includes(";base64,") ? image.split(";base64,")[1] : image;
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${apiKey}`;

  const payload: any = {
    contents: [
      {
        parts: [
          {
            inlineData: {
              mimeType: mimeType,
              data: cleanBase64
            }
          },
          {
            text: prompt
          }
        ]
      }
    ],
    systemInstruction: {
      parts: [
        {
          text: systemInstruction
        }
      ]
    }
  };

  if (schema) {
    payload.generationConfig = {
      responseMimeType: "application/json",
      responseSchema: schema
    };
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorText = await response.text();
    let parsedErr;
    try {
      parsedErr = JSON.parse(errorText);
    } catch(e) {}
    const geminiMessage = parsedErr?.error?.message || errorText;
    throw new Error(`Gemini Client Call Failed (${response.status}): ${geminiMessage}`);
  }

  const data = await response.json();
  let text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error("Empty response from client-side Gemini API.");
  }

  text = text.trim();
  if (text.startsWith("```")) {
    text = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  }
  return text.trim();
};

export const chatWithDocumentClient = async (
  image: string,
  mimeType: string,
  systemInstruction: string,
  message: string,
  history: any[]
) => {
  const apiKey = (import.meta.env.VITE_GEMINI_API_KEY as string) || localStorage.getItem('VITE_GEMINI_API_KEY');
  if (!apiKey) {
    throw new Error(
      "Static Host (Netlify) Detected: Your VITE_GEMINI_API_KEY is not configured in Netlify Site environment variables."
    );
  }

  const cleanBase64 = image.includes(";base64,") ? image.split(";base64,")[1] : image;
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${apiKey}`;

  const imagePart = {
    inlineData: {
      mimeType: mimeType,
      data: cleanBase64
    }
  };

  const contents: any[] = [];
  if (history && Array.isArray(history)) {
    for (const turn of history) {
      contents.push({
        role: turn.role === "user" ? "user" : "model",
        parts: [{ text: turn.text }]
      });
    }
  }

  // Current turn: image + query
  contents.push({
    role: "user",
    parts: [imagePart, { text: message }]
  });

  const payload = {
    contents,
    systemInstruction: {
      parts: [{ text: systemInstruction }]
    }
  };

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorText = await response.text();
    let parsedErr;
    try {
      parsedErr = JSON.parse(errorText);
    } catch(e) {}
    const geminiMessage = parsedErr?.error?.message || errorText;
    throw new Error(`Gemini Client Chat Failed (${response.status}): ${geminiMessage}`);
  }

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error("Empty response from client-side Gemini chat API.");
  }
  return text;
};
