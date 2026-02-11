import type { Express } from "express";
import { type Server } from "http";
import { chatRequestSchema, type ChatResponse, type HistoryResponse } from "@shared/schema";
import OpenAI from "openai";
import fs from "fs";
import path from "path";
import {
  getLastMessages,
  getSummary,
  saveMessage,
  getMessageCount,
  upsertSummary,
  clearHistory,
  getAllMessages,
  getLearnedPreferences,
  bulkUpsertPreferences,
  clearPreferences,
} from "./db";

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
  "pilar", "prodem",
  "rotasi", "mutasi",
  "sop", "prosedur",
  "risiko organisasi", "risiko sistem",
  "struktur organisasi",
  "penilaian", "assessment",
  "kesesuaian", "fit and proper",
  "aisg"
];

const RISK_GUARD_KEYWORDS = [
  "risiko", "risk",
  "martingale", "averaging",
  "leverage", "margin",
  "drawdown", "loss",
  "money management",
  "aman atau tidak", "aman gak", "aman nggak", "aman tidak",
  "perlindungan nasabah",
  "margin call",
  "overtrading",
  "black swan",
  "lot", "entry", "exit",
  "sinyal", "signal",
  "stop loss", "take profit",
  "cut loss",
  "floating", "floating loss",
  "likuidasi",
  "eksposur", "exposure",
  "hedging", "hedge",
  "risk reward", "risk management",
  "manajemen risiko",
  "bahaya", "berbahaya",
  "rugi", "kerugian",
  "modal habis", "modal hilang",
  "bangkrut",
];

const COMPLIANCE_KEYWORDS = [
  "kyc", "know your customer",
  "kepatuhan", "compliance",
  "kewajaran", "wajar",
  "nasabah bermasalah", "nasabah komplain",
  "komplain", "sengketa",
  "eskalasi",
  "dokumentasi", "pencatatan",
  "red flag",
  "apu ppt", "anti pencucian", "pencucian uang",
  "sumber dana", "dana tidak jelas",
  "profil nasabah",
  "regulasi",
  "top up besar", "withdrawal besar",
  "jaminan hasil", "janji hasil",
  "outlier",
  "perlindungan nasabah",
  "preventif", "pencegahan",
  "tata kelola operasional",
  "pelanggaran",
  "sanksi regulasi",
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

function detectComplianceIntent(message: string): boolean {
  const lower = message.toLowerCase();

  if (COMPLIANCE_KEYWORDS.some((kw) => lower.includes(kw))) {
    return true;
  }

  const compliancePatterns = [
    /nasabah\s+(bermasalah|komplain|baru\s+bermasalah)/i,
    /sumber\s+(dana|uang)\s+(tidak|gak?|nggak?)\s*(jelas|konsisten)/i,
    /profil\s+(nasabah|customer|klien)/i,
    /top\s+up\s+(besar|segera|setelah\s+rugi)/i,
    /jaminan\s+(hasil|keuntungan|profit|return)/i,
    /janji\s+(hasil|keuntungan|profit|return)/i,
    /dana\s+(besar|tidak\s+jelas|mencurigakan)/i,
    /pola\s+(transaksi|komplain|withdrawal|top\s+up)/i,
    /eskalasi\s+(internal|ke\s+direksi|ke\s+kepatuhan)/i,
    /cabang\s+(outlier|bermasalah)/i,
    /risiko\s+(reputasi|operasional|kepatuhan|compliance)/i,
    /apakah\s+(ini\s+)?wajar/i,
  ];

  return compliancePatterns.some((p) => p.test(lower));
}

function detectRiskGuardIntent(message: string): boolean {
  const lower = message.toLowerCase();

  if (RISK_GUARD_KEYWORDS.some((kw) => lower.includes(kw))) {
    return true;
  }

  const riskPatterns = [
    /aman\s+(gak|nggak|tidak|atau|ga)\s*/i,
    /risiko\s+(trading|investasi|transaksi|strategi)/i,
    /bahaya\s+(martingale|averaging|leverage)/i,
    /berapa\s+(lot|margin|leverage)/i,
    /bisa\s+(rugi|bangkrut|habis|hilang)/i,
    /modal\s+(habis|hilang|ludes|amblas)/i,
    /margin\s+call/i,
    /stop\s+loss/i,
    /take\s+profit/i,
    /cut\s+loss/i,
    /money\s+management/i,
    /risk\s+(reward|management|control)/i,
    /manajemen\s+risiko/i,
    /floating\s+(loss|minus|negatif)/i,
    /perlindungan\s+(nasabah|investor|dana)/i,
    /strategi\s+(aman|berbahaya|berisiko)/i,
    /kasih\s+(sinyal|signal|lot|entry|exit)/i,
    /minta\s+(sinyal|signal|lot|entry|exit)/i,
  ];

  return riskPatterns.some((p) => p.test(lower));
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
  const USER_ID = "mas_dr";

  app.get("/api/history", (_req, res) => {
    try {
      const msgs = getAllMessages(USER_ID);
      const response: HistoryResponse = {
        messages: msgs.map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })),
      };
      return res.json(response);
    } catch (err: any) {
      console.error("History API error:", err?.message || err);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/clear", (_req, res) => {
    try {
      clearHistory(USER_ID);
      clearPreferences(USER_ID);
      return res.json({ success: true });
    } catch (err: any) {
      console.error("Clear API error:", err?.message || err);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/preferences", (_req, res) => {
    try {
      const preferences = getLearnedPreferences(USER_ID);
      return res.json({ preferences });
    } catch (err: any) {
      console.error("Preferences API error:", err?.message || err);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/chat", async (req, res) => {
    try {
      const parsed = chatRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid request body" });
      }

      const { message } = parsed.data;

      const corePrompt = readPromptFile("DARVIS_CORE.md");
      if (!corePrompt) {
        return res.status(500).json({ message: "System prompt not found" });
      }

      const nodesUsed: string[] = [];
      let systemContent = corePrompt;

      const isBias = detectBiasIntent(message);
      const isSolidGroup = detectSolidGroupIntent(message);
      const isAiSG = detectAiSGIntent(message);
      const isNM = detectNMIntent(message);
      const isRiskGuard = detectRiskGuardIntent(message);
      const isCompliance = detectComplianceIntent(message);

      if (isBias) {
        const biasPrompt = readPromptFile("DARVIS_NODE_BIAS.md");
        if (biasPrompt) {
          systemContent += `\n\n---\nNODE CONTEXT AKTIF: NODE_BIAS (PRIORITAS UTAMA)\n\n${biasPrompt}`;
          nodesUsed.push("NODE_BIAS");
        }
      }

      if (isRiskGuard) {
        const riskPrompt = readPromptFile("DARVIS_NODE_RISK_GUARD.md");
        if (riskPrompt) {
          systemContent += `\n\n---\nNODE CONTEXT AKTIF: NODE_RISK_GUARD (PENGAMAN)\n\n${riskPrompt}`;
          nodesUsed.push("NODE_RISK_GUARD");
        }
      }

      if (isNM && !isRiskGuard) {
        const nmPrompt = readPromptFile("DARVIS_NODE_NM.md");
        if (nmPrompt) {
          systemContent += `\n\n---\nNODE CONTEXT AKTIF: NODE_NM\n\n${nmPrompt}`;
          nodesUsed.push("NODE_NM");
        }
      } else if (isNM && isRiskGuard) {
        const nmPrompt = readPromptFile("DARVIS_NODE_NM.md");
        if (nmPrompt) {
          systemContent += `\n\n---\nNODE CONTEXT TAMBAHAN: NODE_NM (subordinat terhadap RISK_GUARD)\n\n${nmPrompt}`;
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

      if (isCompliance) {
        const compliancePrompt = readPromptFile("DARVIS_NODE_COMPLIANCE.md");
        if (compliancePrompt) {
          systemContent += `\n\n---\nNODE CONTEXT AKTIF: NODE_COMPLIANCE\n\n${compliancePrompt}`;
          nodesUsed.push("NODE_COMPLIANCE");
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

      const learnedPrefs = getLearnedPreferences(USER_ID);
      if (learnedPrefs.length > 0) {
        const grouped: Record<string, string[]> = {};
        for (const pref of learnedPrefs) {
          if (!grouped[pref.category]) grouped[pref.category] = [];
          grouped[pref.category].push(pref.insight);
        }
        let prefBlock = "\n\n---\nAUTO-LEARN: PROFIL & PREFERENSI MAS DR\nBerikut adalah hal-hal yang sudah DARVIS pelajari dari percakapan sebelumnya. Gunakan insight ini untuk memberikan respons yang lebih personal dan relevan:\n\n";
        for (const [cat, insights] of Object.entries(grouped)) {
          prefBlock += `[${cat}]\n`;
          for (const ins of insights) {
            prefBlock += `- ${ins}\n`;
          }
          prefBlock += "\n";
        }
        prefBlock += "Catatan: Gunakan profil ini secara natural, jangan sebutkan secara eksplisit bahwa kamu 'sudah belajar' dari percakapan sebelumnya. Integrasikan ke dalam gaya respons.";
        systemContent += prefBlock;
      }

      const apiMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];
      apiMessages.push({ role: "system", content: systemContent });

      const summary = getSummary(USER_ID);
      if (summary) {
        apiMessages.push({
          role: "system",
          content: `RINGKASAN PERCAKAPAN SEBELUMNYA:\n${summary}`,
        });
      }

      const recentMessages = getLastMessages(USER_ID, 10);
      for (const msg of recentMessages) {
        apiMessages.push({
          role: msg.role === "user" ? "user" : "assistant",
          content: msg.content,
        });
      }

      apiMessages.push({ role: "user", content: message });

      const completion = await openai.chat.completions.create({
        model: "gpt-5",
        messages: apiMessages,
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

      saveMessage(USER_ID, "user", message);
      saveMessage(USER_ID, "assistant", reply);

      const msgCount = getMessageCount(USER_ID);
      if (msgCount > 0 && msgCount % 20 === 0) {
        generateSummary(USER_ID).catch((err) => {
          console.error("Auto-summary error:", err?.message || err);
        });
      }

      if (msgCount > 0 && msgCount % 10 === 0) {
        extractPreferences(USER_ID).catch((err) => {
          console.error("Auto-learn error:", err?.message || err);
        });
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

async function extractPreferences(userId: string) {
  const allMessages = getAllMessages(userId);
  if (allMessages.length < 6) return;

  const last20 = allMessages.slice(-20);
  const conversationText = last20
    .map((m) => `${m.role === "user" ? "User" : "DARVIS"}: ${m.content}`)
    .join("\n\n");

  const existingPrefs = getLearnedPreferences(userId);
  const existingContext = existingPrefs.length > 0
    ? `\nPreferensi yang sudah diketahui sebelumnya:\n${existingPrefs.map(p => `- [${p.category}] ${p.insight}`).join("\n")}\n\nPerbarui atau tambahkan insight baru berdasarkan percakapan terbaru. Jangan duplikasi yang sudah ada kecuali ada perubahan.`
    : "";

  const prompt = `Kamu adalah DARVIS, asisten berpikir untuk mas DR. Analisis percakapan berikut dan ekstrak insight tentang profil, preferensi, dan pola berpikir mas DR.
${existingContext}
Percakapan terbaru:
${conversationText}

Ekstrak insight dalam format JSON array. Setiap insight harus memiliki:
- category: salah satu dari "gaya_berpikir", "preferensi_komunikasi", "konteks_bisnis", "pola_keputusan", "area_fokus", "koreksi_penting"
- insight: deskripsi singkat (1-2 kalimat) dalam bahasa Indonesia
- confidence: angka 0.5-1.0 (seberapa yakin insight ini valid)
- source_summary: ringkasan singkat bukti dari percakapan

RULES:
- Hanya ekstrak insight yang jelas terlihat dari percakapan, jangan berasumsi
- "koreksi_penting" = hal yang user koreksi atau tidak setuju, ini PALING PENTING untuk dipelajari
- "gaya_berpikir" = cara user mendekati masalah (analitis, intuitif, hati-hati, dll)
- "preferensi_komunikasi" = gaya komunikasi yang disukai (ringkas, detail, formal, santai)
- "konteks_bisnis" = informasi tentang bisnis, peran, industri, prioritas user
- "pola_keputusan" = bagaimana user biasa membuat keputusan
- "area_fokus" = topik yang sering dibahas atau dipentingkan
- Maksimal 8 insight per ekstraksi
- Jika tidak ada insight baru yang jelas, kembalikan array kosong []

Respond ONLY with valid JSON array, no other text.`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-5",
      messages: [{ role: "user", content: prompt }],
      max_completion_tokens: 2048,
    });

    const raw = completion.choices[0]?.message?.content?.trim();
    if (!raw) return;

    const jsonMatch = raw.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return;

    const parsed = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(parsed) || parsed.length === 0) return;

    const validCategories = ["gaya_berpikir", "preferensi_komunikasi", "konteks_bisnis", "pola_keputusan", "area_fokus", "koreksi_penting"];
    const validPrefs = parsed
      .filter((p: any) =>
        p.category && validCategories.includes(p.category) &&
        p.insight && typeof p.insight === "string" &&
        typeof p.confidence === "number" && p.confidence >= 0.5 && p.confidence <= 1.0
      )
      .slice(0, 8)
      .map((p: any) => ({
        category: p.category as string,
        insight: p.insight as string,
        confidence: p.confidence as number,
        source_summary: (p.source_summary as string) || null,
      }));

    if (validPrefs.length > 0) {
      bulkUpsertPreferences(userId, validPrefs);
      console.log(`Auto-learn: extracted ${validPrefs.length} preferences for ${userId}`);
    }
  } catch (err: any) {
    console.error("Preference extraction failed:", err?.message || err);
  }
}

async function generateSummary(userId: string) {
  const allMessages = getAllMessages(userId);
  if (allMessages.length < 10) return;

  const last30 = allMessages.slice(-30);
  const conversationText = last30
    .map((m) => `${m.role === "user" ? "User" : "DARVIS"}: ${m.content}`)
    .join("\n\n");

  const existingSummary = getSummary(userId);

  const prompt = existingSummary
    ? `Kamu adalah DARVIS, asisten berpikir untuk mas DR.\n\nRingkasan sebelumnya:\n${existingSummary}\n\nPercakapan terbaru:\n${conversationText}\n\nBuatkan ringkasan singkat (max 300 kata) yang menggabungkan ringkasan sebelumnya dan percakapan terbaru. Fokus pada: topik yang dibahas, keputusan penting, konteks emosional, dan insight yang muncul. Tulis dalam bahasa Indonesia.`
    : `Kamu adalah DARVIS, asisten berpikir untuk mas DR.\n\nPercakapan:\n${conversationText}\n\nBuatkan ringkasan singkat (max 300 kata) dari percakapan ini. Fokus pada: topik yang dibahas, keputusan penting, konteks emosional, dan insight yang muncul. Tulis dalam bahasa Indonesia.`;

  const completion = await openai.chat.completions.create({
    model: "gpt-5",
    messages: [{ role: "user", content: prompt }],
    max_completion_tokens: 2048,
  });

  const summaryText = completion.choices[0]?.message?.content?.trim();
  if (summaryText) {
    upsertSummary(userId, summaryText);
    console.log(`Auto-summary generated for ${userId} (${allMessages.length} messages)`);
  }
}
