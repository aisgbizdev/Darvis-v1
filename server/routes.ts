import type { Express } from "express";
import { type Server } from "http";
import { chatRequestSchema, type ChatResponse } from "@shared/schema";
import OpenAI from "openai";
import fs from "fs";
import path from "path";

// the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const SOLID_GROUP_KEYWORDS = [
  "solid", "solid group", "rfb", "bpf", "kpf", "ewf", "sgb",
  "berjangka", "website resmi", "afiliasi", "holding", "grup",
  "rifan", "bestprofit", "kontak perkasa", "equityworld", "solid gold",
  "legalitas", "pt "
];

function readPromptFile(filename: string): string {
  try {
    const filePath = path.join(process.cwd(), "prompts", filename);
    return fs.readFileSync(filePath, "utf-8");
  } catch {
    return "";
  }
}

function detectSolidGroupIntent(message: string): boolean {
  const lower = message.toLowerCase();
  return SOLID_GROUP_KEYWORDS.some((kw) => lower.includes(kw));
}

function enforceFormat(reply: string): string {
  const hasBroto = /Broto\s*:/i.test(reply);
  const hasRara = /Rara\s*:/i.test(reply);

  if (hasBroto && hasRara) return reply;

  if (!hasBroto && !hasRara) {
    const sentences = reply.split(/(?<=[.!?])\s+/);
    const mid = Math.ceil(sentences.length / 2);
    const brotoPart = sentences.slice(0, mid).join(" ");
    const raraPart = sentences.slice(mid).join(" ") || brotoPart;
    return `Broto: ${brotoPart}\n\nRara: ${raraPart}`;
  }

  if (!hasBroto) return `Broto: ${reply}\n\nRara: Saya sependapat dengan apa yang sudah disampaikan, mas DR.`;
  if (!hasRara) return `${reply}\n\nRara: Setuju mas DR, pertimbangkan juga sisi emosional dari keputusan ini.`;

  return reply;
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  app.post("/api/chat", async (req, res) => {
    try {
      const parsed = chatRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid request body" });
      }

      const { message, history } = parsed.data;

      const corePrompt = readPromptFile("DARVIS_CORE.md");
      if (!corePrompt) {
        return res.status(500).json({ message: "System prompt not found" });
      }

      const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];

      let nodeUsed: string | null = null;
      let systemContent = corePrompt;

      if (detectSolidGroupIntent(message)) {
        const solidPrompt = readPromptFile("DARVIS_NODE_SolidGroup.md");
        if (solidPrompt) {
          systemContent += `\n\n---\nNODE CONTEXT AKTIF: NODE_SOLIDGROUP\n\n${solidPrompt}`;
          nodeUsed = "NODE_SOLIDGROUP";
        }
      }

      messages.push({ role: "system", content: systemContent });

      if (history && history.length > 0) {
        for (const msg of history.slice(-10)) {
          messages.push({
            role: msg.role === "user" ? "user" : "assistant",
            content: msg.content,
          });
        }
      }

      const lastInHistory = history?.at(-1);
      const isLastMessageSameAsInput =
        lastInHistory?.role === "user" && lastInHistory?.content === message;

      if (!isLastMessageSameAsInput) {
        messages.push({ role: "user", content: message });
      }

      const completion = await openai.chat.completions.create({
        model: "gpt-5",
        messages,
        max_completion_tokens: 8192,
      });

      const choice = completion.choices[0];
      const rawReply = choice?.message?.content || "";
      
      let reply: string;
      if (!rawReply.trim()) {
        reply = "Broto: Maaf mas DR, saya butuh waktu untuk memproses pertanyaan ini. Bisa coba ulangi?\n\nRara: Tenang mas DR, kadang perlu pendekatan berbeda. Coba sampaikan pertanyaan dengan cara lain ya.";
      } else {
        reply = enforceFormat(rawReply);
      }

      const response: ChatResponse = { reply, nodeUsed };
      return res.json(response);
    } catch (err: any) {
      console.error("Chat API error:", err?.message || err);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  return httpServer;
}
