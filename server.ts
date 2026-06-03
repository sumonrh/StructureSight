import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Max out standard sizes since blueprints can be high resolution base64
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // AI Drawing Review API Endpoint
  app.post("/api/analyze", async (req: express.Request, res: express.Response) => {
    try {
      const { image, provider, apiKey, model, customPrompt, drawingText, requirementsText } = req.body;

      if (!image) {
        return res.status(400).json({ error: "Missing image data for calculation" });
      }

      // Clean image string from base64 representation header
      const cleanImg = image.replace(/^data:image\/[a-zA-Z]+;base64,/, "");

      // Robust Structural Engineering review prompt representing Independent review board
      const systemInstruction = `You are an expert, highly meticulous Independent Lead Structural Design Reviewer with decades of experience reviewing structural engineering drawings, blueprints, and calculation sheets for major bridges, commercial buildings, steel trusses, and concrete substructures.

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
        apiKey, 
        model, 
        message, 
        history = [], 
        drawingText, 
        requirementsText 
      } = req.body;

      if (!message) {
        return res.status(400).json({ error: "Missing message parameter for Chat." });
      }

      const systemInstruction = `You are an expert, highly meticulous Independent Lead Structural Design Reviewer and Veteran Civil Engineer.
Your role now is to assist the user by answering specific engineering questions in real-time about the current structural drawing sheet, blueprint, or referenced standard documents.

Help the user by analyzing details visible in the image, text embedded in the drawing, or the requirements PDF reference.
Be highly accurate, constructive, mathematically precise, and safety-focused. Cite standard codes (e.g. ACI 318, AISC 360, IBC, ASCE 7) where appropriate.`;

      let finalPrompt = message;
      let contextInfo = "";
      if (drawingText) {
        contextInfo += `[EXTRACTED TEXT FROM CURRENT DRAWING SHEET]\n${drawingText}\n\n`;
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

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server starting on port ${PORT}`);
  });
}

startServer();
