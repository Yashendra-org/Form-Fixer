# Form-Fixer: Smart Bharat Digital Platform
### *National Civic Document Completeness & Bilingual Self-Correction Portal*

Form-Fixer is a privacy-first, high-performance web application designed to empower citizens of India/Bharat to successfully navigate, fill, and self-correct government service application forms. Utilizing an advanced client-side vision workspace and a tiered validation pipeline, Form-Fixer guides users in real-time to identify missing signatures, unfilled fields, or incorrect formats before submission, significantly reducing form rejection rates at civic centers (e.g., Aadhaar Kendras, RTO offices).

---

## 🗺️ System Workflow Architecture (3D Projection)

Below is an isometric visual diagram mapping how a citizen's document travels through the validation pipeline, from capture to final multi-turn self-correction.

```text
               +----------------------------------------+
               |  Citizen Uploads / Captures Form       |
               |  (JPEG / PNG / WEBP, e.g., Aadhaar/PAN)|
               +-------------------+--------------------+
                                   |
                                   v
+==================================+===================================+
|               STAGE 1: CLIENT-SIDE WORKSPACE                         |
|                                                                      |
|     +-------------------------+      +-------------------------+     |
|     |  Canvas Auto-Crop       | ---> |  Smart Auto-Compressor  |     |
|     |  & Deskew Grid          |      |  (Resolution optimizer) |     |
|     +------------+------------+      +------------+------------+     |
|                  |                                |                  |
|                  +----------------+---------------+                  |
|                                   |                                  |
+==================================+===================================+
                                   | (Optimized Base64 stream)
                                   v
+==================================+===================================+
|               STAGE 2: BACKEND PIPELINE & PRIVACY                    |
|                                                                      |
|                  +--------------------------------+                  |
|                  | Express Node.js Server Gateway |                  |
|                  +----------------+---------------+                  |
|                                   |                                  |
|                                   v                                  |
|                  +--------------------------------+                  |
|                  |  Privacy Guard Redactor        |                  |
|                  |  (Filters Aadhaar/PAN / IDs)   |                  |
|                  +----------------+---------------+                  |
|                                   |                                  |
|                                   v                                  |
|                  +--------------------------------+                  |
|                  |  Gemini Multi-Modal Vision API |                  |
|                  |  (OCR & Form Layout Analysis)  |                  |
|                  +--------------------------------+                  |
+==================================+===================================+
                                   |
                                   v
+==================================+===================================+
|               STAGE 3: CITIZEN INTERACTION INTERFACE                  |
|                                                                      |
|        /=======================================================\     |
|       ||   [1] Interactive Magnifier & Highlighter Workspace  ||     |
|       ||       * Green Highlights: FILLED Field               ||     |
|       ||       * Orange Highlights: MISSING Signature/Block   ||     |
|       ||       * Red Highlights: INCORRECT Format             ||     |
|        \=======================================================/     |
|                                   |                                  |
|                                   v                                  |
|        /=======================================================\     |
|       ||   [2] Bilingual / Hinglish Q&A Chat Companion        ||     |
|       ||       * Custom voice playbacks in EN & HI           ||     |
|       ||       * Answers UIDAI / RTO document policies       ||     |
|        \=======================================================/     |
|                                   |                                  |
|                                   v                                  |
|        /=======================================================\     |
|       ||   [3] Local RLHF Neural Alignment Feedback Loop      ||     |
|       ||       * Citizen logs feedback rating on layout accuracy||     |
|        \=======================================================/     |
+======================================================================++
```

---

## 🛠️ Technology Stack

| Layer | Technologies | Role / Utility |
| :--- | :--- | :--- |
| **Frontend UI** | React 18+, TypeScript, Tailwind CSS, Framer Motion | High-fidelity interactive layout, fluid route transitions, and responsive responsive visual density. |
| **Client Workspace** | HTML5 Canvas Engine, Web Speech API (TTS) | Coordinates image rotations, high-contrast document boundary scanning, manual crop reticles, and multi-dialect text-to-speech feedback. |
| **Backend API Gateway** | Express v4, Node.js, esbuild, tsx | API proxying for security key masking, static bundle routing, and server-side production execution. |
| **AI Vision & NLP** | Google Gemini 2.5 Flash / Pro (via `@google/genai` SDK) | Dual-stage OCR extraction, logical checklist evaluation, and conversational code-switching. |
| **Persistence & Caching** | HTML5 LocalStorage | Maintains offline document verification logs, session chat buffers, and user configuration preferences. |

---

## 📂 Project Folder Structure

```text
.
├── .env.example                # Blueprint for local secret credentials
├── .gitignore                  # Prevents caching of node_modules and builds
├── index.html                  # Core single-page entry point
├── metadata.json               # Frame permissions and major applet metadata
├── package.json                # Project dependency manifest and compilation scripts
├── server.ts                   # Full-Stack Express Server (API Proxy + Vite Middleware)
├── tsconfig.json               # TypeScript compiler rules
├── vite.config.ts              # Vite asset pipelines and Tailwind integrations
└── src/                        # Client-Side Codebase
    ├── main.tsx                # Client bootstrapper
    ├── index.css               # Global Tailwind CSS directives and font face bindings
    ├── geminiClient.ts         # High-level server-side LLM connection client configurations
    ├── App.tsx                 # Core parent React component containing state routing
    ├── assets/                 # Brand design files
    │   └── images/
    │       └── form_fixer_logo_1784189901251.jpg
    └── components/             # Reusable UI Modules
        └── AutoCropModal.tsx   # Canvas-based Auto-Cropping & Boundary Alignment Workspace
```

---

## 🌟 Core Features & Functional Details

### 1. **Intelligent Canvas-Based Auto-Crop & Deskew**
* **Contrast Edge Scanning:** When an image is loaded, a background canvas analyzes pixel luminance, scanning inward to detect document boundaries (e.g., paper borders against a darker desk).
* **Flexible Aspect Ratio Snapping:** Quickly lock the crop boundaries to standard aspect ratios:
  * **Card Ratio (85:54):** Perfect for Aadhaar Cards, Pan Cards, and Voter IDs.
  * **A4 Portrait:** Fits standard government certificate forms.
  * **Freeform:** Custom sizing for any irregular scan.
* **Interactive Reticle Handles:** 4-corner draggable handles allowing fine manual crop adjustments.
* **Rotational Deskewing:** Quick 90° rotational alignment to correct sideways or inverted uploads instantly.

### 2. **Bhasini-Compliant Privacy Redaction**
* Real-time automated parser identifies high-risk identifiers (such as 12-digit Aadhaar numbers, 10-character PAN identifiers, and mobile phone numbers).
* Obfuscates sensitive strings directly from text layout coordinates, ensuring raw client-sensitive records are never displayed or stored.

### 3. **Bilingual & Hinglish Code-Switching AI Companion**
* **Dialect-Adaptive Intelligence:** If typed in English, responds in English. If typed in Hindi, responds in Devanagari Hindi. If typed in **Hinglish** (e.g., *"Aadhaar center kahan hai?"*), the assistant dynamically mirrors the Hinglish blend (e.g., *"Aapka nikattam Aadhaar Center check karne ke liye..."*).
* **Dual-Language Speech Playback:** Reads out loud answers in either Indian English or Hindi accents, resolving device synthesis fallbacks gracefully.

### 4. **Pre-Validation & Dynamic Mock Form Generator**
* To facilitate immediate testing, Form-Fixer includes a built-in pre-populated Mock Form generator.
* Simulates incomplete Aadhaar forms, missing signature voter cards, or wrong document types to showcase the tiered validation pipeline in actions.

---

## 🚀 Getting Started

### 📦 Prerequisites
* **Node.js** (v18.0.0 or higher recommended)
* **npm** (v9.0.0 or higher)

### ⚙️ Environment Configuration
Create a `.env` file in the root directory to authorize your LLM services:
```env
GEMINI_API_KEY=your_gemini_api_key_here
```

### 💻 Installation
1. Install project dependencies:
   ```bash
   npm install
   ```

2. Run in Development Mode:
   ```bash
   npm run dev
   ```
   *Serves the hot-reloading full-stack application on http://localhost:3000*

3. Compile and Bundle for Production:
   ```bash
   npm run build
   ```
   *Vite bundles client-side assets while esbuild packages the backend typescript server into a standalone optimized CommonJS module (`dist/server.cjs`).*

4. Run the Production Build:
   ```bash
   npm start
   ```

---

## 🏛️ Supported Civic Forms
* **UIDAI Aadhaar Cards** (Enrollment / Corrections / Demographic Updates)
* **Income Tax Department PAN Cards** (Form 49A)
* **Ministry of Road Transport & Highways Driving License** (Form 4)
* **Ministry of External Affairs Passports** (Fresh / Re-issue Form 1)
* **Election Commission of India Voter ID Cards** (Form 6 / Correction Form 8)
* **Ayushman Bharat Golden Card** (National Health Registrations)

---

## 🔒 Security & Citizen Privacy
Form-Fixer is designed around a **Zero-Knowledge Privacy Policy**. All core image crops, rotations, and pre-checks happen strictly inside the local browser container. Any text coordinates forwarded for Gemini validation are pre-redacted of private citizen ID numbers.
