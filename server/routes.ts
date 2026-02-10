import type { Express } from "express";
import { type Server } from "http";
import { chatRequestSchema, type ChatResponse } from "@shared/schema";
import OpenAI from "openai";
import fs from "fs";
import path from "path";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const SOLID_GROUP_KEYWORDS = [
  "solid", "solid group", "rfb", "bpf", "kpf", "ewf", "sgb",
  "berjangka", "website resmi", "afiliasi", "holding", "grup",
  "rifan", "bestprofit", "kontak perkasa", "equityworld", "solid gold",
  "legalitas", "pt "
];

const NM_KEYWORDS = [
  "harga", "price",
  "emas", "gold", "xau", "xauusd",
  "oil", "minyak", "energy", "energi", "crude",
  "market", "pasar", "bursa",
  "inflasi", "inflation",
  "suku bunga", "interest rate",
  "the fed", "federal reserve", "bank sentral", "bank indonesia",
  "data ekonomi", "news", "outlook",
  "indeks", "index", "ihsg", "dow jones", "nasdaq", "s&p",
  "forex", "valas", "kurs", "dollar", "dolar",
  "commodity", "komoditas",
  "obligasi", "bond", "yield",
  "gdp", "pdb",
  "nonfarm", "nfp", "cpi", "ppi",
  "rally", "bearish", "bullish", "sideways",
  "resistance", "support", "breakout",
  "sentimen", "sentiment",
  "resesi", "recession",
  "tapering", "quantitative",
  "trading", "investasi"
];

const AISG_KEYWORDS = [
  "audit", "evaluasi", "evaluasi kinerja",
  "kinerja", "performa", "performance",
  "cabang", "tim", "divisi", "departemen",
  "peran", "posisi", "jabatan", "job desc",
  "overload", "beban kerja",
  "disiplin", "konsistensi",
  "integritas",
  "early warning", "ews",
  "governance", "tata kelola",
  "kepatuhan", "compliance",
  "pilar", "prodem",
  "rotasi", "mutasi",
  "sop", "prosedur",
  "risiko organisasi", "risiko sistem",
  "struktur organisasi",
  "penilaian", "assessment",
  "kesesuaian", "fit and proper",
  "aisg"
];

const BIAS_KEYWORDS = [
  "ragu", "bingung", "takut",
  "fomo", "impulsif",
  "capek", "cape", "burnout", "stres", "stress",
  "tekanan", "target berat",
  "emosi", "panik", "cemas", "gelisah", "khawatir",
  "overconfidence", "terlalu yakin", "pede banget", "ge er",
  "galau", "bimbang", "nggak tenang", "gak tenang", "tidak tenang",
  "frustasi", "frustrasi", "putus asa",
  "overwhelm", "kewalahan",
  "nggak bisa mikir", "gak bisa mikir", "tidak bisa berpikir",
  "tertekan", "dipaksa", "terpaksa",
  "loss aversion", "sunk cost", "confirmation bias",
  "ikut-ikutan", "ikut ikutan", "herd", "fomo banget",
  "terlalu optimis", "bias", "mental",
  "lelah", "capai", "kelelahan",
  "grogi", "nervous", "deg-degan", "deg degan",
  "minder", "ragu-ragu", "ragu ragu",
  "overthinking", "kepikiran terus",
  "nekat", "gegabah", "terburu", "buru-buru", "buru buru"
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

function detectBiasIntent(message: string): boolean {
  const lower = message.toLowerCase();

  if (BIAS_KEYWORDS.some((kw) => lower.includes(kw))) {
    return true;
  }

  const biasPatterns = [
    /gak?\s*(bisa|mampu)\s*(pikir|mikir|tenang|fokus)/i,
    /nggak?\s*(bisa|mampu)\s*(pikir|mikir|tenang|fokus)/i,
    /tidak\s*(bisa|mampu)\s*(berpikir|tenang|fokus)/i,
    /terlalu\s+(yakin|pede|optimis|percaya\s+diri)/i,
    /takut\s+(salah|rugi|gagal|ketinggalan)/i,
    /harus\s+(cepat|sekarang|segera)\s*(ambil|putus|eksekusi)/i,
    /kepala\s+(pusing|mumet|berat)/i,
    /pikiran\s+(kacau|campur\s*aduk|berantakan)/i,
    /kondisi\s+(mental|emosi|psikolog)/i,
    /perasaan\s+(campur|berat|kacau|galau)/i,
  ];

  if (biasPatterns.some((p) => p.test(lower))) {
    return true;
  }

  const decisionWords = ["keputusan", "putuskan", "pilih", "ambil langkah", "eksekusi", "maju", "mundur", "lanjut", "stop", "berhenti"];
  const uncertaintyWords = ["gimana", "gmn", "gmana", "kayaknya", "sepertinya", "entah", "gatau", "gak tau", "nggak tau", "tidak tahu", "belum yakin", "belum pasti", "susah", "sulit", "dilema", "serba salah"];

  const hasDecision = decisionWords.some((w) => lower.includes(w));
  const hasUncertainty = uncertaintyWords.some((w) => lower.includes(w));

  if (hasDecision && hasUncertainty) {
    return true;
  }

  return false;
}

function detectAiSGIntent(message: string): boolean {
  const lower = message.toLowerCase();

  if (AISG_KEYWORDS.some((kw) => lower.includes(kw))) {
    return true;
  }

  const aisgPatterns = [
    /evaluasi\s+(kinerja|cabang|tim|individu|peran)/i,
    /audit\s+(internal|cabang|tim|individu|sistem|organisasi)/i,
    /beban\s+(kerja|tugas)\s+(berat|berlebih|terlalu)/i,
    /(tidak|nggak?|gak?)\s+(sesuai|cocok)\s+(peran|posisi|jabatan)/i,
    /early\s+warning/i,
    /tata\s+kelola/i,
    /fit\s+and\s+proper/i,
    /struktur\s+(organisasi|tim|cabang)/i,
    /pola\s+(kerja|perilaku|kinerja)/i,
    /indikator\s+(kinerja|risiko|peringatan)/i,
  ];

  return aisgPatterns.some((p) => p.test(lower));
}

function detectNMIntent(message: string): boolean {
  const lower = message.toLowerCase();

  if (NM_KEYWORDS.some((kw) => lower.includes(kw))) {
    return true;
  }

  const nmPatterns = [
    /harga\s+(emas|gold|minyak|oil|saham)/i,
    /kondisi\s+(pasar|market|ekonomi)/i,
    /data\s+(ekonomi|makro|market)/i,
    /suku\s+bunga/i,
    /bank\s+(sentral|indonesia|central)/i,
    /the\s+fed/i,
    /berapa\s+(harga|kurs|nilai)/i,
    /naik\s+(turun|drastis|tajam|signifikan)/i,
    /turun\s+(drastis|tajam|signifikan|terus)/i,
    /pasar\s+(global|domestik|keuangan|modal)/i,
    /analisis?\s+(teknikal|fundamental|market|pasar)/i,
    /tren\s+(pasar|market|harga|ekonomi)/i,
  ];

  return nmPatterns.some((p) => p.test(lower));
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

      const nodesUsed: string[] = [];
      let systemContent = corePrompt;

      const isBias = detectBiasIntent(message);
      const isSolidGroup = detectSolidGroupIntent(message);
      const isAiSG = detectAiSGIntent(message);
      const isNM = detectNMIntent(message);

      if (isBias) {
        const biasPrompt = readPromptFile("DARVIS_NODE_BIAS.md");
        if (biasPrompt) {
          systemContent += `\n\n---\nNODE CONTEXT AKTIF: NODE_BIAS (PRIORITAS UTAMA)\n\n${biasPrompt}`;
          nodesUsed.push("NODE_BIAS");
        }
      }

      if (isNM) {
        const nmPrompt = readPromptFile("DARVIS_NODE_NM.md");
        if (nmPrompt) {
          systemContent += `\n\n---\nNODE CONTEXT AKTIF: NODE_NM\n\n${nmPrompt}`;
          nodesUsed.push("NODE_NM");
        }
      }

      if (isAiSG) {
        const aisgPrompt = readPromptFile("DARVIS_NODE_AiSG.md");
        if (aisgPrompt) {
          systemContent += `\n\n---\nNODE CONTEXT AKTIF: NODE_AiSG\n\n${aisgPrompt}`;
          nodesUsed.push("NODE_AiSG");
        }
      }

      if (isSolidGroup) {
        const solidPrompt = readPromptFile("DARVIS_NODE_SolidGroup.md");
        if (solidPrompt) {
          systemContent += `\n\n---\nNODE CONTEXT AKTIF: NODE_SOLIDGROUP\n\n${solidPrompt}`;
          nodesUsed.push("NODE_SOLIDGROUP");
        }
      }

      if (nodesUsed.length > 1) {
        const hasBiasNode = nodesUsed.includes("NODE_BIAS");
        const multiNodeInstruction = hasBiasNode
          ? `PRIORITASKAN NODE_BIAS untuk refleksi awal. Turunkan klaim — jangan memberi advice, jangan memberi instruksi. Fokus pada kondisi manusia di balik pertanyaan ini terlebih dahulu, baru sentuh konteks domain lain secara ringan.`
          : `Lebih dari satu konteks domain terdeteksi. Turunkan klaim dan gunakan bahasa reflektif. Jangan memberi penilaian final atau keputusan. Bantu user melihat dari berbagai sudut pandang.`;
        systemContent += `\n\n---\nINSTRUKSI MULTI-NODE:\nNode aktif: ${nodesUsed.join(", ")}. ${multiNodeInstruction}`;
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

      const nodeUsed = nodesUsed.length > 0 ? nodesUsed.join(", ") : null;
      const response: ChatResponse = { reply, nodeUsed };
      return res.json(response);
    } catch (err: any) {
      console.error("Chat API error:", err?.message || err);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  return httpServer;
}
