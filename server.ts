import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "10mb" }));

// Prevent caching for all /api endpoints
app.use("/api", (_req, res, next) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  next();
});

// Health Check API Route
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", environment: process.env.NODE_ENV || "development" });
});

// Gemini AI API Route (Server-Side Key ONLY, Non-Streaming)
app.post("/api/gemini", async (req, res) => {
  try {
    const { prompt, model, contents } = req.body || {};
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      console.warn("GEMINI_API_KEY missing in environment variables.");
      return res.status(500).json({
        error: "GEMINI_API_KEY_MISSING",
        message: "A chave GEMINI_API_KEY não foi configurada no servidor.",
      });
    }

    const ai = new GoogleGenAI({ apiKey });
    const selectedModel = model || "gemini-2.5-flash";
    const userPrompt = prompt || contents || "Por favor, forneça uma análise.";

    // Non-streaming generateContent
    const response = await ai.models.generateContent({
      model: selectedModel,
      contents: userPrompt,
    });

    return res.json({
      status: "success",
      text: response.text || "",
      candidates: response.candidates || [],
    });
  } catch (error: any) {
    console.error("Erro na rota /api/gemini:", error);
    return res.status(500).json({
      error: error.name || "GEMINI_SERVER_ERROR",
      message: error.message || "Erro interno ao consultar o Gemini no servidor.",
      stack: process.env.NODE_ENV !== "production" ? error.stack : undefined,
    });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
