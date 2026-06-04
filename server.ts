import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import { onRequest } from "firebase-functions/v2/https";
import crypto from "crypto";

dotenv.config();

// Generate ephemeral RSA-2048 key pair on startup for secure API key transit
const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", {
  modulusLength: 2048,
  publicKeyEncoding: {
    type: "spki",
    format: "pem"
  },
  privateKeyEncoding: {
    type: "pkcs8",
    format: "pem"
  }
});

function decryptApiKey(key: string): string {
  if (!key) return "";
  if (key.length > 200) {
    try {
      const buffer = Buffer.from(key, "base64");
      const decrypted = crypto.privateDecrypt(
        {
          key: privateKey,
          padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
          oaepHash: "sha256",
        },
        buffer
      );
      return decrypted.toString("utf8");
    } catch (err) {
      console.error("Decryption error:", err);
      throw new Error("Failed to decrypt secure API key. Please reload page.");
    }
  }
  return key;
}

function extractJson(text: string): string {
  if (!text) return "[]";
  let cleanText = text.trim();
  // Strip code block markers if present
  cleanText = cleanText.replace(/^\s*```json/i, "").replace(/^\s*```/i, "").replace(/```\s*$/, "").trim();
  
  const startBracket = cleanText.indexOf('[');
  const startBrace = cleanText.indexOf('{');
  let startIdx = -1;
  let isArray = true;
  if (startBracket !== -1 && (startBrace === -1 || startBracket < startBrace)) {
    startIdx = startBracket;
    isArray = true;
  } else if (startBrace !== -1) {
    startIdx = startBrace;
    isArray = false;
  }
  if (startIdx !== -1) {
    const endIdx = isArray ? cleanText.lastIndexOf(']') : cleanText.lastIndexOf('}');
    if (endIdx !== -1 && endIdx > startIdx) {
      cleanText = cleanText.substring(startIdx, endIdx + 1);
    }
  }
  return cleanText;
}

const PORT = process.env.PORT || 3000;

async function getApp() {
  const app = express();

  // Max out standard sizes since blueprints can be high resolution base64
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // Public key endpoint for secure API key client transit
  app.get("/api/public-key", (req, res) => {
    res.json({ publicKey });
  });

  // AI Drawing Review API Endpoint
  app.post("/api/analyze", async (req: express.Request, res: express.Response) => {
    try {
      const { image, provider, apiKey: rawApiKey, model, customPrompt, drawingText, requirementsText, checklist } = req.body;
      const apiKey = decryptApiKey(rawApiKey);

      if (!image) {
        return res.status(400).json({ error: "Missing image data for calculation" });
      }

      // Clean image string from base64 representation header
      const cleanImg = image.replace(/^data:image\/[a-zA-Z]+;base64,/, "");

      // Robust Structural Engineering review prompt representing Independent review board
      const systemInstruction = `You are an expert, highly meticulous Independent Design Reviewer with decades of experience reviewing structural engineering drawings, blueprints, and calculation sheets for major bridges, commercial buildings, steel trusses, and concrete substructures.

Your goal is to perform a rigorous, safety-oriented, and highly analytical review of the provided structural engineering drawing of a building, bridge, or structural asset.

When analyzing the drawing, adhere to these sections for your analytical response:
1. DETECT ELEMENTS: Identify key structural elements shown in this drawing sheet, such as beams, girders, columns, piles, piers, abutments, joints, steel trusses, shear walls, slabs, foundation details, rebar reinforcement patterns, and connection systems.
2. CRITICAL SAFETY EVALUATION & LOAD PATHS: Scrutinize the drawing for potential design anomalies, stress concentrations, load path discontinuity, insufficient reinforcement detailing (e.g. embedment, tension splices), non-redundant configurations, and risk of progressive collapse, torsional shear, or seismic vulnerability.
3. CODE ALIGNMENT & DESIGN CHECK: Assume compliance checks under standard structural design codes (such as ACI 318 for Concrete structure, AISC 360 for Steel structure, AASHTO for Bridge systems, ASCE 7 for Loading criteria, or International Building Code IBC). State any detailing that feels questionable.
4. TEXT COMPONENT ANALYSIS & SPECIFICATIONS EXTRACTION: Extract important annotations, materials scheduling grids, design loads (DL, LL, WL, SL), material specs (e.g., concrete f'c, steel yield strength fy, rebar grades) or specific callout phrases printed on this drawing page.
5. RECOMMENDATIONS & IMPROVEMENTS: Suggest constructive engineering revisions, structural enhancements, load pathway additions, detailing revisions, or recommend specific calculations or finite element analyses that structural engineers should carry out to verify security.

Adopt a highly professional, authoritative, objective, and deeply constructive tone. Be mathematically and structurally precise. Highlight risks clearly. Avoid superficial flattery.`;

      let finalPrompt = customPrompt || "Analyze this structural drawing in detail. Perform an independent engineer's review of the safety, load transfers, rebar / connection detailing, map out text / notes, and propose concrete design suggestions.";

      if (drawingText) {
        finalPrompt += `\n\n[EXTRACTED TEXT FROM GRAPHIC DRAWING SHEET]\n${drawingText}`;
      }

      if (requirementsText) {
        finalPrompt += `\n\n[USER-PROVIDED REFERENCE STANDARDS, REGULATORY SPECS & REQUIREMENT DOCUMENTS]\n${requirementsText}\n\nCRITICAL DIRECTIVE: Test and audit the structural drawing details specifically against the above user-provided requirements/standards document. Report any discrepancies, non-compliant dimensioning, sizing errors, material deviations, or spacing conflicts with standard limits, and provide concrete actionable engineering recommendations to ensure safety and safety compliance.`;
      }

      if (checklist && Array.isArray(checklist) && checklist.length > 0) {
        const checklistStr = checklist
          .map((item: any) => `- [${item.category.toUpperCase()}] ${item.label}`)
          .join('\n');
        finalPrompt += `\n\n[ENGINEERING REVIEW CHECKLIST]\nPlease verify the structural drawing details specifically against the following checklist criteria:\n${checklistStr}\n\nIn your review report, explicitly state which checklist criteria are met, which are not met, and what design changes/corrections are required to satisfy them.`;
      }

      if (provider === "gemini") {
        // Use Gemini API
        const geminiKey = apiKey || process.env.GEMINI_API_KEY;
        if (!geminiKey) {
          return res.status(400).json({ error: "Gemini API Key is not configured on the server. Please verify the Gemini API Key is set in Settings -> Secrets, or provide a custom key." });
        }

        const ai = new GoogleGenAI({
          apiKey: geminiKey,
          httpOptions: {
            headers: {
              'User-Agent': 'aistudio-build'
            }
          }
        });

        const selectedModel = model || "gemini-3.5-flash";

        const imagePart = {
          inlineData: {
            mimeType: "image/jpeg",
            data: cleanImg,
          }
        };

        const textPart = {
          text: finalPrompt
        };

        const response = await ai.models.generateContent({
          model: selectedModel,
          contents: { parts: [imagePart, textPart] },
          config: {
            systemInstruction: systemInstruction,
          }
        });

        return res.json({ analysis: response.text || "No analysis response generated by the Gemini model." });

      } else if (provider === "openai") {
        const openAIKey = apiKey;
        if (!openAIKey) {
          return res.status(400).json({ error: "OpenAI API Key is missing. Please enter your OpenAI API key in the configuration sidebar." });
        }

        const selectedModel = model || "gpt-4o";

        const response = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${openAIKey}`
          },
          body: JSON.stringify({
            model: selectedModel,
            messages: [
              { "role": "system", "content": systemInstruction },
              {
                "role": "user",
                "content": [
                  { "type": "text", "text": finalPrompt },
                  { "type": "image_url", "image_url": { "url": `data:image/jpeg;base64,${cleanImg}` } }
                ]
              }
            ]
          })
        });

        if (!response.ok) {
          const errText = await response.text();
          return res.status(response.status).json({ error: `OpenAI API returns an error: ${errText}` });
        }

        const data: any = await response.json();
        const content = data.choices?.[0]?.message?.content || "No analysis returned from ChatGPT.";
        return res.json({ analysis: content });

      } else if (provider === "anthropic") {
        const anthropicKey = apiKey;
        if (!anthropicKey) {
          return res.status(400).json({ error: "Anthropic API key is missing. Please enter your Claude API key in the configuration sidebar." });
        }

        const selectedModel = model || "claude-3-5-sonnet-latest";

        const response = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": anthropicKey,
            "anthropic-version": "2023-06-01"
          },
          body: JSON.stringify({
            model: selectedModel,
            max_tokens: 4000,
            system: systemInstruction,
            messages: [
              {
                "role": "user",
                "content": [
                  {
                    "type": "image",
                    "source": {
                      "type": "base64",
                      "media_type": "image/jpeg",
                      "data": cleanImg
                    }
                  },
                  {
                    "type": "text",
                    "text": finalPrompt
                  }
                ]
              }
            ]
          })
        });

        if (!response.ok) {
          const errText = await response.text();
          return res.status(response.status).json({ error: `Anthropic API returns an error: ${errText}` });
        }

        const data: any = await response.json();
        const content = data.content?.[0]?.text || "No analysis returned from Claude.";
        return res.json({ analysis: content });

      } else if (provider === "grok") {
        const grokKey = apiKey;
        if (!grokKey) {
          return res.status(400).json({ error: "xAI Grok API key is missing. Please enter your Grok API key in the configuration sidebar." });
        }

        const selectedModel = model || "grok-2-vision-1212";

        const response = await fetch("https://api.x.ai/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${grokKey}`
          },
          body: JSON.stringify({
            model: selectedModel,
            messages: [
              { "role": "system", "content": systemInstruction },
              {
                "role": "user",
                "content": [
                  { "type": "text", "text": finalPrompt },
                  { "type": "image_url", "image_url": { "url": `data:image/jpeg;base64,${cleanImg}` } }
                ]
              }
            ]
          })
        });

        if (!response.ok) {
          const errText = await response.text();
          return res.status(response.status).json({ error: `xAI Grok API returns an error: ${errText}` });
        }

        const data: any = await response.json();
        const content = data.choices?.[0]?.message?.content || "No analysis returned from Grok.";
        return res.json({ analysis: content });

      } else {
        return res.status(400).json({ error: `Unsupported provider: ${provider}` });
      }

    } catch (error: any) {
      console.error("API proxy error:", error);
      return res.status(500).json({ error: error.message || "An unexpected server exception occurred." });
    }
  });

  // AI Interactive Engineering Chat Endpoint
  app.post("/api/chat", async (req: express.Request, res: express.Response) => {
    try {
      const { 
        image, 
        provider, 
        apiKey: rawApiKey, 
        model, 
        message, 
        history = [], 
        drawingText, 
        requirementsText 
      } = req.body;
      const apiKey = decryptApiKey(rawApiKey);

      if (!message) {
        return res.status(400).json({ error: "Missing message parameter for Chat." });
      }

      const systemInstruction = `You are an expert, highly meticulous Independent Design Reviewer and Veteran Civil Engineer.
Your role now is to assist the user by answering specific engineering questions in real-time about the structural drawing sheets, blueprint pages, or referenced standard documents.

Help the user by analyzing details visible in the image of the current active sheet, text embedded across all sheets of the drawing, or the requirements PDF reference.
Be highly accurate, constructive, mathematically precise, and safety-focused. Cite standard codes (e.g. ACI 318, AISC 360, IBC, ASCE 7) where appropriate.`;

      let finalPrompt = message;
      let contextInfo = "";
      if (drawingText) {
        contextInfo += `[EXTRACTED TEXT FROM DRAWING SHEETS]\n${drawingText}\n\n`;
      }
      if (requirementsText) {
        contextInfo += `[USER-PROVIDED REFERENCE STANDARDS & REQUIREMENTS]\n${requirementsText}\n\n`;
      }
      
      if (contextInfo) {
        finalPrompt = `${contextInfo}[USER QUESTION]\n${message}`;
      }

      // Clean image string from base64 representation header
      const cleanImg = image ? image.replace(/^data:image\/[a-zA-Z]+;base64,/, "") : null;

      if (provider === "gemini") {
        const geminiKey = apiKey || process.env.GEMINI_API_KEY;
        if (!geminiKey) {
          return res.status(400).json({ error: "Gemini API Key is not configured on the server. Please verify the Gemini API Key is set in Settings -> Secrets, or provide a custom key." });
        }

        const ai = new GoogleGenAI({
          apiKey: geminiKey,
          httpOptions: {
            headers: {
              'User-Agent': 'aistudio-build'
            }
          }
        });

        const selectedModel = model || "gemini-3.5-flash";

        // Map conversational history
        const contents = history.map((msg: any) => ({
          role: msg.role === "assistant" ? "model" : "user",
          parts: [{ text: msg.content }]
        }));

        // Append active/latest user prompt
        contents.push({
          role: "user",
          parts: [
            ...(cleanImg ? [{ inlineData: { mimeType: "image/jpeg", data: cleanImg } }] : []),
            { text: finalPrompt }
          ]
        });

        const response = await ai.models.generateContent({
          model: selectedModel,
          contents: contents,
          config: {
            systemInstruction: systemInstruction,
          }
        });

        return res.json({ reply: response.text || "I was unable to formulate a response to your question." });

      } else if (provider === "openai") {
        const openAIKey = apiKey;
        if (!openAIKey) {
          return res.status(400).json({ error: "OpenAI API Key is missing. Please enter your OpenAI API key in the configuration sidebar." });
        }

        const selectedModel = model || "gpt-4o";

        const messages = [
          { role: "system", content: systemInstruction },
          ...history.map((h: any) => ({
            role: h.role === "assistant" ? "assistant" : "user",
            content: h.content
          })),
          {
            role: "user",
            content: [
              { type: "text", text: finalPrompt },
              ...(cleanImg ? [{ type: "image_url", image_url: { url: `data:image/jpeg;base64,${cleanImg}` } }] : [])
            ]
          }
        ];

        const response = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${openAIKey}`
          },
          body: JSON.stringify({
            model: selectedModel,
            messages: messages
          })
        });

        if (!response.ok) {
          const errText = await response.text();
          return res.status(response.status).json({ error: `OpenAI API error: ${errText}` });
        }

        const data: any = await response.json();
        const content = data.choices?.[0]?.message?.content || "No reply from ChatGPT.";
        return res.json({ reply: content });

      } else if (provider === "anthropic") {
        const anthropicKey = apiKey;
        if (!anthropicKey) {
          return res.status(400).json({ error: "Anthropic API key is missing. Please enter your Claude API key in the configuration sidebar." });
        }

        const selectedModel = model || "claude-3-5-sonnet-latest";

        const messages = [
          ...history.map((h: any) => ({
            role: h.role === "assistant" ? "assistant" : "user",
            content: h.content
          })),
          {
            role: "user",
            content: [
              ...(cleanImg ? [{
                type: "image",
                source: {
                  type: "base64",
                  media_type: "image/jpeg",
                  data: cleanImg
                }
              }] : []),
              {
                type: "text",
                text: finalPrompt
              }
            ]
          }
        ];

        const response = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": anthropicKey,
            "anthropic-version": "2023-06-01"
          },
          body: JSON.stringify({
            model: selectedModel,
            max_tokens: 4000,
            system: systemInstruction,
            messages: messages
          })
        });

        if (!response.ok) {
          const errText = await response.text();
          return res.status(response.status).json({ error: `Anthropic API error: ${errText}` });
        }

        const data: any = await response.json();
        const content = data.content?.[0]?.text || "No reply from Claude.";
        return res.json({ reply: content });

      } else if (provider === "grok") {
        const grokKey = apiKey;
        if (!grokKey) {
          return res.status(400).json({ error: "xAI Grok API key is missing. Please enter your Grok API key in the configuration sidebar." });
        }

        const selectedModel = model || "grok-2-vision-1212";

        const messages = [
          { role: "system", content: systemInstruction },
          ...history.map((h: any) => ({
            role: h.role === "assistant" ? "assistant" : "user",
            content: h.content
          })),
          {
            role: "user",
            content: [
              { type: "text", text: finalPrompt },
              ...(cleanImg ? [{ type: "image_url", image_url: { url: `data:image/jpeg;base64,${cleanImg}` } }] : [])
            ]
          }
        ];

        const response = await fetch("https://api.x.ai/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${grokKey}`
          },
          body: JSON.stringify({
            model: selectedModel,
            messages: messages
          })
        });

        if (!response.ok) {
          const errText = await response.text();
          return res.status(response.status).json({ error: `xAI Grok API error: ${errText}` });
        }

        const data: any = await response.json();
        const content = data.choices?.[0]?.message?.content || "No reply from Grok.";
        return res.json({ reply: content });

      } else {
        return res.status(400).json({ error: `Unsupported provider: ${provider}` });
      }

    } catch (error: any) {
      console.error("API Chat proxy error:", error);
      return res.status(500).json({ error: error.message || "An unexpected server exception occurred." });
    }
  });

  // AI Checklist Generation Endpoint based on reference standards PDF
  app.post("/api/generate-checklist", async (req: express.Request, res: express.Response) => {
    try {
      const { provider, apiKey: rawApiKey, model, requirementsText } = req.body;
      const apiKey = decryptApiKey(rawApiKey);

      if (!requirementsText) {
        return res.status(400).json({ error: "Missing requirements text to generate checklist" });
      }

      const systemInstruction = `You are an expert structural design checklist generator. Your task is to extract a list of 6 to 10 highly specific, actionable engineering checklist items from the provided reference standards & specs text. 
Each item must fall into one of these four categories: 'safety', 'detailing', 'compliance', or 'materials'.
You must return a valid JSON array of objects representing the checklist items. Do not include markdown code block formatting (such as \`\`\`json). Output only the raw JSON.
Each object must have the following structure:
{
  "id": "string (e.g. c1, c2, c3)",
  "label": "string (specific engineering verification statement, e.g., 'Verify shear reinforcement spacing is within ACI 318 limits')",
  "checked": false,
  "category": "string (must be 'safety', 'detailing', 'compliance', or 'materials')"
}`;

      const prompt = `Based on the following reference standards & requirements text, generate the engineering review checklist:\n\n${requirementsText}`;

      if (provider === "gemini") {
        const geminiKey = apiKey || process.env.GEMINI_API_KEY;
        if (!geminiKey) {
          return res.status(400).json({ error: "Gemini API Key is not configured on the server. Please verify the Gemini API Key is set in Settings -> Secrets, or provide a custom key." });
        }

        const ai = new GoogleGenAI({
          apiKey: geminiKey,
          httpOptions: {
            headers: {
              'User-Agent': 'aistudio-build'
            }
          }
        });

        const selectedModel = model || "gemini-3.5-flash";

        const response = await ai.models.generateContent({
          model: selectedModel,
          contents: prompt,
          config: {
            systemInstruction: systemInstruction,
            responseMimeType: "application/json",
          }
        });

        const cleanText = extractJson(response.text || "[]");
        const parsed = JSON.parse(cleanText);
        const checklistArray = Array.isArray(parsed) ? parsed : (parsed.checklist || parsed.items || []);
        return res.json({ checklist: checklistArray });

      } else if (provider === "openai") {
        const openAIKey = apiKey;
        if (!openAIKey) {
          return res.status(400).json({ error: "OpenAI API Key is missing. Please enter your OpenAI API key in the configuration sidebar." });
        }

        const selectedModel = model || "gpt-4o";

        const response = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${openAIKey}`
          },
          body: JSON.stringify({
            model: selectedModel,
            response_format: { type: "json_object" },
            messages: [
              { "role": "system", "content": systemInstruction },
              { "role": "user", "content": prompt }
            ]
          })
        });

        if (!response.ok) {
          const errText = await response.text();
          return res.status(response.status).json({ error: `OpenAI API returns an error: ${errText}` });
        }

        const data: any = await response.json();
        const content = data.choices?.[0]?.message?.content || "[]";
        const cleanText = extractJson(content);
        const parsed = JSON.parse(cleanText);
        const checklistArray = Array.isArray(parsed) ? parsed : (parsed.checklist || parsed.items || []);
        return res.json({ checklist: checklistArray });

      } else if (provider === "anthropic") {
        const anthropicKey = apiKey;
        if (!anthropicKey) {
          return res.status(400).json({ error: "Anthropic API key is missing. Please enter your Claude API key in the configuration sidebar." });
        }

        const selectedModel = model || "claude-3-5-sonnet-latest";

        const response = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": anthropicKey,
            "anthropic-version": "2023-06-01"
          },
          body: JSON.stringify({
            model: selectedModel,
            max_tokens: 2000,
            system: systemInstruction,
            messages: [
              { "role": "user", "content": prompt }
            ]
          })
        });

        if (!response.ok) {
          const errText = await response.text();
          return res.status(response.status).json({ error: `Anthropic API error: ${errText}` });
        }

        const data: any = await response.json();
        const content = data.content?.[0]?.text || "[]";
        const cleanText = extractJson(content);
        const parsed = JSON.parse(cleanText);
        const checklistArray = Array.isArray(parsed) ? parsed : (parsed.checklist || parsed.items || []);
        return res.json({ checklist: checklistArray });

      } else if (provider === "grok") {
        const grokKey = apiKey;
        if (!grokKey) {
          return res.status(400).json({ error: "xAI Grok API key is missing. Please enter your Grok API key in the configuration sidebar." });
        }

        const selectedModel = model || "grok-2-1212";

        const response = await fetch("https://api.x.ai/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${grokKey}`
          },
          body: JSON.stringify({
            model: selectedModel,
            messages: [
              { "role": "system", "content": systemInstruction },
              { "role": "user", "content": prompt }
            ]
          })
        });

        if (!response.ok) {
          const errText = await response.text();
          return res.status(response.status).json({ error: `xAI Grok API error: ${errText}` });
        }

        const data: any = await response.json();
        const content = data.choices?.[0]?.message?.content || "[]";
        const cleanText = extractJson(content);
        const parsed = JSON.parse(cleanText);
        const checklistArray = Array.isArray(parsed) ? parsed : (parsed.checklist || parsed.items || []);
        return res.json({ checklist: checklistArray });

      } else {
        return res.status(400).json({ error: `Unsupported provider: ${provider}` });
      }

    } catch (error: any) {
      console.error("Generate checklist error:", error);
      return res.status(500).json({ error: error.message || "An unexpected error occurred while generating checklist." });
    }
  });

  // Serve static assets / Vite middle-tier
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  return app;
}

let appInstance: any = null;
async function getAppInstance() {
  if (!appInstance) {
    appInstance = await getApp();
  }
  return appInstance;
}

// Export the Cloud Function API handler
export const api = onRequest({
  cors: true,
  memory: "1GiB",
  timeoutSeconds: 300,
}, async (req, res) => {
  const app = await getAppInstance();
  app(req, res);
});

// Run standalone server if not deployed as a Firebase Cloud Function
if (!process.env.FIREBASE_CONFIG || process.env.FUNCTIONS_EMULATOR) {
  getAppInstance().then((app) => {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server starting on port ${PORT}`);
    });
  });
}
