import type { Express } from "express";
import { type Server } from "http";
import { chatRequestSchema, type ChatResponse, type HistoryResponse } from "@shared/schema";
import OpenAI from "openai";
import fs from "fs";
import path from "path";
import multer from "multer";
import mammoth from "mammoth";
import * as XLSX from "xlsx";
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
  getPersonaFeedback,
  bulkSavePersonaFeedback,
  clearPersonaFeedback,
  getProfileEnrichments,
  bulkSaveProfileEnrichments,
  seedDRProfileForUser,
  saveConversationTag,
  getConversationTags,
  clearConversationTags,
  getPassword,
  setSetting,
  getTeamMembers,
  getTeamMemberById,
  getTeamMemberByNameOrAlias,
  type TeamMember,
  upsertTeamMember,
  updateTeamMember,
  deleteTeamMember,
  getMeetings,
  getMeetingById,
  getUpcomingMeetings,
  getTodayMeetings,
  createMeeting,
  updateMeeting,
  deleteMeeting,
  getActionItems,
  getOverdueActionItems,
  getPendingActionItems,
  getActionItemById,
  createActionItem,
  updateActionItem,
  deleteActionItem,
  getProjects,
  getProjectById,
  upsertProject,
  updateProject,
  deleteProject,
  getNotifications,
  getUnreadNotificationCount,
  createNotification,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
  deleteAllNotifications,
  cleanupOldNotifications,
  savePushSubscription,
  getChatRooms,
  getChatRoomById,
  createChatRoom,
  renameChatRoom,
  deleteChatRoom,
  getLastMessagesForRoom,
  getAllMessagesForRoom,
  saveMessageToRoom,
  getMessageCountForRoom,
  clearRoomHistory,
  getRoomSummary,
  setRoomSummary,
  getAllRoomSummaries,
  moveMessagesToRoom,
  mergeRooms,
} from "./db";
import { getVapidPublicKey, sendPushToAll } from "./push";
import { getWIBDateString, getWIBTimeString, getWIBDayName, parseWIBTimestamp } from "./proactive";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const ENRICHMENT_CATEGORY_LABELS: Record<string, string> = {
  persepsi_orang: "Persepsi Orang Lain",
  tokoh_idola: "Tokoh Idola & Inspirasi",
  film_favorit: "Film Favorit",
  prinsip_spiritual: "Spiritual & Religius",
  karakter_personal: "Karakter Personal",
  kebiasaan: "Kebiasaan",
  filosofi: "Filosofi Hidup",
  preferensi: "Preferensi & Selera",
};

const SOLID_GROUP_KEYWORDS = [
  "solid group", "solid gold berjangka", "sgb",
  "rfb", "bpf", "kpf", "ewf",
  "rifan", "rifan financindo", "bestprofit",
  "kontak perkasa", "equityworld",
  "solid gold"
];

const NM_KEYWORDS = [
  "newsmaker", "nm23",
  "harga emas", "harga gold", "harga minyak", "harga oil",
  "xau", "xauusd",
  "crude oil",
  "inflasi", "inflation",
  "suku bunga", "interest rate",
  "the fed", "federal reserve", "bank sentral",
  "data ekonomi", "outlook pasar",
  "ihsg", "dow jones", "nasdaq", "s&p",
  "forex", "valas",
  "komoditas", "commodity",
  "nonfarm", "nfp", "cpi", "ppi",
  "bearish", "bullish", "sideways",
  "resistance", "support", "breakout",
  "sentimen pasar", "sentiment",
  "resesi", "recession",
  "tapering", "quantitative",
  "analisis market", "analisis pasar"
];

const AISG_KEYWORDS = [
  "aisg", "aisg23",
  "evaluasi kinerja", "audit kinerja", "audit internal",
  "18 pilar", "pilar kompetensi",
  "prodem",
  "early warning system", "ews",
  "fit and proper",
  "governance",
  "struktur organisasi",
  "risiko organisasi", "risiko sistem"
];

const RISK_GUARD_KEYWORDS = [
  "martingale", "averaging down",
  "leverage", "margin call",
  "drawdown",
  "money management",
  "aman atau tidak", "aman gak", "aman nggak", "aman tidak",
  "perlindungan nasabah",
  "overtrading",
  "black swan",
  "stop loss", "take profit",
  "cut loss",
  "floating loss",
  "likuidasi",
  "eksposur", "exposure",
  "hedging", "hedge",
  "risk reward", "risk management",
  "manajemen risiko",
  "modal habis", "modal hilang",
  "bangkrut",
];

const COMPLIANCE_KEYWORDS = [
  "kyc", "know your customer",
  "kepatuhan", "compliance",
  "nasabah bermasalah", "nasabah komplain",
  "sengketa nasabah",
  "red flag",
  "apu ppt", "anti pencucian", "pencucian uang",
  "sumber dana tidak jelas", "dana mencurigakan",
  "profil nasabah",
  "top up besar", "withdrawal besar",
  "jaminan hasil", "janji hasil",
  "perlindungan nasabah",
  "tata kelola operasional",
  "pelanggaran regulasi",
  "sanksi regulasi",
];

const BIAS_KEYWORDS = [
  "fomo", "impulsif",
  "burnout",
  "tekanan berat", "target berat",
  "overconfidence", "terlalu yakin", "pede banget",
  "nggak tenang", "gak tenang", "tidak tenang",
  "frustasi", "frustrasi", "putus asa",
  "overwhelm", "kewalahan",
  "nggak bisa mikir", "gak bisa mikir", "tidak bisa berpikir",
  "loss aversion", "sunk cost", "confirmation bias",
  "ikut-ikutan", "ikut ikutan", "herd mentality",
  "terlalu optimis", "bias kognitif",
  "overthinking", "kepikiran terus",
  "nekat", "gegabah",
  "ragu-ragu", "ragu ragu",
  "deg-degan", "deg degan"
];

const promptCache: Record<string, string> = {};
function readPromptFile(filename: string): string {
  if (promptCache[filename] !== undefined) return promptCache[filename];
  try {
    const filePath = path.join(process.cwd(), "prompts", filename);
    promptCache[filename] = fs.readFileSync(filePath, "utf-8");
    return promptCache[filename];
  } catch {
    promptCache[filename] = "";
    return "";
  }
}

function detectConversationTone(message: string): { emotional: boolean; analytical: boolean; evaluative: boolean; urgent: boolean } {
  const lower = message.toLowerCase();

  const emotionalPatterns = [
    /capek|cape|lelah|burnout|stres|stress|frustasi|frustrasi/i,
    /galau|bingung|ragu|takut|cemas|gelisah|panik|khawatir/i,
    /gimana\s+(ya|nih|dong|sih)/i,
    /gak\s+tau\s+(harus|mau|bisa)/i,
    /berat\s+banget/i,
    /pusing|mumet|overwhelm|kewalahan/i,
    /curhat|cerita|sharing/i,
    /perasaan|hati|mood|mental/i,
    /capek\s+(banget|bgt|bat)/i,
    /gw\s+(capek|cape|lelah|stress|stres)/i,
    /aku\s+(capek|cape|lelah|stress|stres)/i,
    /saya\s+(capek|cape|lelah|stress|stres)/i,
  ];

  const analyticalPatterns = [
    /berapa\s+(angka|margin|profit|loss|target|lot|persentase)/i,
    /hitung|kalkulasi|persentase|ratio|perbandingan/i,
    /analisa\s+(ini|itu|data|angka)/i,
    /breakdown\s+(angka|data|biaya|margin)/i,
    /coba\s+(hitung|kalkulasi|bandingkan|analisa)/i,
  ];

  const evaluativePatterns = [
    /evaluasi\s+(kinerja|tim|cabang|individu|orang)/i,
    /audit\s+(internal|cabang|tim)/i,
    /tim\s+(ini|gw|saya|aku)\s+(gak|tidak|nggak|kurang|lemah)/i,
    /anak\s+buah|bawahan/i,
    /promosi|demosi/i,
    /coaching\s+(ini|dia|tim|orang)/i,
    /orang\s+ini\s+(gak|tidak|nggak|kurang)/i,
    /gimana\s+(cara|caranya)\s+(evaluasi|nilai|assess)/i,
  ];

  const urgentPatterns = [
    /sekarang|segera|urgent|darurat|cepat|buruan/i,
    /harus\s+(sekarang|segera|cepat|hari\s+ini)/i,
    /deadline|tenggat|batas\s+waktu/i,
    /langsung\s+(eksekusi|jalan|gas|mulai)/i,
    /gak\s+(bisa|boleh)\s+nunggu/i,
  ];

  return {
    emotional: emotionalPatterns.some(p => p.test(lower)),
    analytical: analyticalPatterns.some(p => p.test(lower)),
    evaluative: evaluativePatterns.some(p => p.test(lower)),
    urgent: urgentPatterns.some(p => p.test(lower)),
  };
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
    /audit\s+(internal|kinerja|organisasi)/i,
    /evaluasi\s+kinerja/i,
    /early\s+warning\s+system/i,
    /fit\s+and\s+proper/i,
    /pilar\s+kompetensi/i,
    /18\s+pilar/i,
  ];

  return aisgPatterns.some((p) => p.test(lower));
}

function detectNMIntent(message: string): boolean {
  const lower = message.toLowerCase();

  if (NM_KEYWORDS.some((kw) => lower.includes(kw))) {
    return true;
  }

  const nmPatterns = [
    /harga\s+(emas|gold|minyak|oil|crude)/i,
    /data\s+(ekonomi|makro)/i,
    /suku\s+bunga/i,
    /the\s+fed/i,
    /analisis?\s+(teknikal|fundamental)/i,
  ];

  return nmPatterns.some((p) => p.test(lower));
}

function detectComplianceIntent(message: string): boolean {
  const lower = message.toLowerCase();

  if (COMPLIANCE_KEYWORDS.some((kw) => lower.includes(kw))) {
    return true;
  }

  const compliancePatterns = [
    /nasabah\s+(bermasalah|komplain)/i,
    /sumber\s+dana\s+(tidak|gak?|nggak?)\s*jelas/i,
    /top\s+up\s+(besar|setelah\s+rugi)/i,
    /jaminan\s+(hasil|keuntungan|profit|return)/i,
    /janji\s+(hasil|keuntungan|profit|return)/i,
    /dana\s+mencurigakan/i,
    /pencucian\s+uang/i,
  ];

  return compliancePatterns.some((p) => p.test(lower));
}

function detectRiskGuardIntent(message: string): boolean {
  const lower = message.toLowerCase();

  if (RISK_GUARD_KEYWORDS.some((kw) => lower.includes(kw))) {
    return true;
  }

  const riskPatterns = [
    /bahaya\s+(martingale|averaging|leverage)/i,
    /berapa\s+(lot|margin|leverage)/i,
    /modal\s+(habis|hilang|ludes|amblas)/i,
    /margin\s+call/i,
    /floating\s+(loss|minus|negatif)/i,
    /kasih\s+(sinyal|signal)/i,
    /minta\s+(sinyal|signal)/i,
  ];

  return riskPatterns.some((p) => p.test(lower));
}

function detectMultiPersonaIntent(message: string): boolean {
  const lower = message.toLowerCase();
  const patterns = [
    /\b(menurut|pendapat|kata)\s+(broto|rara|rere|dr)\b/,
    /\b(gimana|bagaimana)\s+(menurut|kata)\s+(broto|rara|rere|dr)\b/,
    /\b(minta\s+pendapat|tanya)\s+(semua\s+persona|4\s+persona|empat\s+persona|semua\s+suara)\b/,
    /\b(dari\s+)?(4|empat)\s+(sudut\s+pandang|perspektif|suara|sisi)\b/,
    /\b(analisis|bedah|bahas)\s+dari\s+(semua|berbagai|masing.masing)\s+(sisi|sudut|perspektif)\b/,
    /\b(apa\s+kata|gimana\s+menurut)\s+(masing.masing|semua)\b/,
    /\bpendapat\s+masing.masing\s+persona\b/,
    /\bbedah\s+dari\s+semua\s+perspektif\b/,
    /\b(broto|rara|rere)\s+(gimana|bagaimana|apa\s+pendapat)\b/,
  ];
  return patterns.some((p) => p.test(lower));
}

function detectDecisionFastMode(message: string): boolean {
  const lower = message.toLowerCase();
  const patterns = [
    /\bquick\b/,
    /\bringkas\b/,
    /\bfast\s+decision\b/,
    /\b10\s+menit\b/,
    /\bsingkat\s+aja\b/,
    /\blangsung\s+inti\b/,
    /\bringkas\s+aja\b/,
    /\bto\s+the\s+point\s+aja\b/,
    /\bcepet\s+aja\b/,
    /\bcepat\s+aja\b/,
  ];
  return patterns.some((p) => p.test(lower));
}

function detectStrategicEscalation(message: string): boolean {
  const lower = message.toLowerCase();
  const patterns = [
    /\binvestasi\b/,
    /\bresign\b/,
    /\bkeluar\s+(dari\s+)?(kantor|perusahaan|kerjaan)\b/,
    /\bpartnership\b/,
    /\bkerjasama\s+(strategis|besar)\b/,
    /\blegal\b/,
    /\bgugat(an)?\b/,
    /\bsomasi\b/,
    /\bmerger\b/,
    /\bakuisisi\b/,
    /\bjual\s+(perusahaan|bisnis|saham)\b/,
    /\bpinjam(an)?\s+(besar|bank|miliar)\b/,
    /\butang\s+(besar|miliar)\b/,
    /\bputus(kan|in)\s+(kontrak|kerjasama)\b/,
    /\bpindah\s+(negara|kota|domisili)\b/,
    /\bnikah\b/,
    /\bcerai\b/,
    /\btutup\s+(bisnis|usaha|perusahaan)\b/,
    /\bphk\b/,
    /\bpecat\b/,
    /\bkeputusan\s+(besar|strategis|penting|krusial)\b/,
    /\birreversible\b/,
    /\btitik\s+balik\b/,
  ];
  return patterns.some((p) => p.test(lower));
}

type ContextMode = "strategic" | "tactical" | "reflection" | "crisis" | "general";

function detectContextMode(message: string, tone: { emotional: boolean; analytical: boolean; evaluative: boolean; urgent: boolean }): ContextMode {
  const lower = message.toLowerCase();

  const crisisPatterns = [
    /\bdarurat\b/,
    /\bkrisis\b/,
    /\bemergency\b/,
    /\bkebakaran\b/,
    /\bmasalah\s+(besar|serius|gawat|parah)\b/,
    /\bharus\s+(sekarang|segera|hari\s+ini)\b/,
    /\bgawat\b/,
    /\bbahaya\s+(besar|serius)\b/,
    /\bkollaps\b/,
    /\bambruk\b/,
    /\bbank\s*rupt\b/,
    /\bbangkrut\b/,
    /\bada\s+masalah\b/,
    /\bterjadi\s+(masalah|insiden|kejadian)\b/,
    /\bsituasi\s+(gawat|darurat|kritis)\b/,
    /\bmeledak\b/,
    /\bescalat/,
    /\btidak\s+terkendali\b/,
    /\bpanik\b/,
  ];

  const strategicPatterns = [
    /\bpresentasi\s+(ke|di|untuk)\s+(bod|board|direksi|komisaris|investor)\b/,
    /\bbod\b/,
    /\bboard\s+(meeting|of\s+directors)\b/,
    /\bdireksi\b/,
    /\bkomisaris\b/,
    /\binvestor\b/,
    /\bstrategi\s+(jangka\s+panjang|besar|bisnis|grup|perusahaan|akuisisi|ekspansi)\b/,
    /\brencana\s+(5|lima|10|sepuluh|jangka\s+panjang)\s*(tahun)?\b/,
    /\bvisi\s+(perusahaan|bisnis|organisasi|grup)\b/,
    /\bmisi\s+(perusahaan|bisnis|organisasi|grup)\b/,
    /\brestrukturisasi\b/,
    /\btransformasi\s+(bisnis|organisasi|digital)\b/,
    /\b[eé]kspansi\b/,
    /\bexpansi\b/,
    /\bakuisisi\b/,
    /\bmerger\b/,
    /\bscaling\b/,
    /\bsuksesi\b/,
    /\bsuccession\b/,
    /\bfundraising\b/,
    /\bipo\b/,
    /\bvaluasi\b/,
    /\bdue\s+diligence\b/,
    /\bkeputusan\s+(strategis|besar|krusial)\b/,
    /\bboard\s+level\b/,
    /\bc-level\b/,
    /\bholding\b/,
    /\bkonsolidasi\b/,
  ];

  const tacticalPatterns = [
    /\beksekusi\s+(ini|itu|gimana|bagaimana)\b/,
    /\btarget\s+(bulan|minggu|kuartal|quarter|q[1-4])\b/,
    /\btimeline\b/,
    /\baction\s+(plan|item|list)\b/,
    /\blangkah.langkah\b/,
    /\bimplementasi\b/,
    /\bsop\b/,
    /\bchecklist\b/,
    /\bprioritas\s+(minggu|bulan|hari)\s+ini\b/,
    /\bdeadline\b/,
    /\btenggat\b/,
    /\bkerjain\s+(gimana|bagaimana)\b/,
    /\bstep\s+by\s+step\b/,
    /\bcara\s+(eksekusi|implementasi|jalanin|kerjain)\b/,
    /\bkpi\b/,
    /\bmilestone\b/,
    /\boperasional\b/,
    /\bhari\s+ini\s+(harus|perlu|mau)\b/,
    /\bminggu\s+ini\s+(harus|perlu|mau)\b/,
  ];

  const reflectionPatterns = [
    /\bcurhat\b/,
    /\brefleksi\b/,
    /\brenungan\b/,
    /\bhidup\s+(gw|gue|saya|aku)\b/,
    /\bgw\s+(bingung|galau|ragu|capek|cape|lelah)\b/,
    /\bevaluasi\s+diri\b/,
    /\bkontemplasi\b/,
    /\bself.reflect/,
    /\bpersonal\b/,
    /\bperasaan\s+(gw|gue|saya|aku)\b/,
    /\bcondition\s+(gw|gue)\b/,
    /\bkondisi\s+(gw|gue|saya|aku)\b/,
    /\bmakna\b/,
    /\btujuan\s+hidup\b/,
    /\bpurpose\b/,
    /\bapa\s+yang\s+(gw|gue|saya|aku)\s+(mau|ingin|cari)\b/,
    /\bsiapa\s+(gw|gue|saya|aku)\s+sebenarnya\b/,
    /\bjalan\s+hidup\b/,
    /\bkarir\s+(gw|gue|saya|aku)\b/,
    /\bmasa\s+depan\s+(gw|gue|saya|aku)\b/,
  ];

  if (crisisPatterns.some(p => p.test(lower))) return "crisis";
  if (tone.urgent && crisisPatterns.some(p => p.test(lower))) return "crisis";

  if (strategicPatterns.some(p => p.test(lower))) return "strategic";

  if (tacticalPatterns.some(p => p.test(lower))) return "tactical";

  if (reflectionPatterns.some(p => p.test(lower))) return "reflection";
  if (tone.emotional && !tone.analytical && !tone.urgent) return "reflection";

  return "general";
}

function classifyDecisionType(message: string): string | null {
  const lower = message.toLowerCase();

  const patterns: [RegExp, string][] = [
    [/\b(hire|rekrut|pecat|phk|promosi|demosi|mutasi|rotasi)\b/, "personel"],
    [/\b(investasi|invest|funding|modal|dana)\b/, "finansial"],
    [/\b(strategi|pivot|transformasi|restrukturisasi|ekspansi)\b/, "strategi_bisnis"],
    [/\b(produk|fitur|launch|peluncuran|release)\b/, "produk"],
    [/\b(partnership|kerjasama|kolaborasi|aliansi|merger|akuisisi)\b/, "kemitraan"],
    [/\b(resign|keluar|pindah|karir)\b/, "karir"],
    [/\b(tim|team|divisi|departemen|organisasi|struktur)\b/, "organisasi"],
    [/\b(sistem|proses|sop|prosedur|workflow)\b/, "operasional"],
    [/\b(personal|hidup|keluarga|kesehatan)\b/, "personal"],
  ];

  for (const [pattern, type] of patterns) {
    if (pattern.test(lower)) return type;
  }
  return null;
}

function applyMemoryGovernor<T extends { confidence?: number; created_at?: string; updated_at?: string }>(
  items: T[],
  maxItems: number = 5
): T[] {
  if (items.length <= maxItems) return items;

  const scored = items.map((item, idx) => {
    const confidence = (item as any).confidence || 0.7;
    const dateStr = (item as any).updated_at || (item as any).created_at || "";
    let recencyScore = 0;
    if (dateStr) {
      const ageMs = Date.now() - new Date(dateStr).getTime();
      const ageDays = ageMs / (1000 * 60 * 60 * 24);
      recencyScore = Math.max(0, 1 - (ageDays / 30));
    } else {
      recencyScore = 1 - (idx / items.length);
    }
    const score = (confidence * 0.4) + (recencyScore * 0.6);
    return { item, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, maxItems).map(s => s.item);
}

function enforceFormat(reply: string, multiPersona: boolean): string {
  let cleaned = reply
    .replace(/^Broto:\s*/im, "")
    .replace(/\n\s*Rara:\s*/im, "\n\n")
    .replace(/\n\s*Rere:\s*/im, "\n\n")
    .replace(/\n\s*DR:\s*/im, "\n\n");
  return cleaned.trim();
}

function detectPersonaMention(message: string): boolean {
  const lower = message.toLowerCase();
  const hasPersonaName = /\b(dr|raha|bapak|bapa|abah|ykw|broto|rara|rere)\b/.test(lower);
  if (!hasPersonaName) return false;

  const opinionSignals = [
    /(?:orangnya|tuh|itu|emang|sih|ya|kan|banget|gitu|kayak|menurut|kenal|menurutku|menurut\s+gw)/,
    /(?:kadang|suka|selalu|terlalu|agak|lumayan|memang|sebenernya|sejujurnya)/,
    /(?:keren|bagus|hebat|pinter|cerdas|keras|tegas|lembut|lucu|kocak|serius|fair|galak|sabar|bijak|visioner|inspiratif)/,
    /(?:kelebihan|kelemahan|kekurangan|sifat|karakter|kepribadian|gaya|cara|style)/,
    /(?:kenal|tau|tahu|kerja\s+bareng|kerja\s+sama|ngobrol|cerita|denger|pernah)/,
    /(?:suka|gak\s+suka|setuju|gak\s+setuju|bener|salah|cocok|pas|tepat)/,
    /(?:lebih\s+baik|harusnya|sebaiknya|kalau\s+boleh|jujur)/,
  ];
  return opinionSignals.some((p) => p.test(lower));
}

function detectDRIdentity(message: string): boolean {
  const lower = message.toLowerCase();
  const patterns = [
    /\b(ini\s+gw\s+dr|gw\s+dr\s+nih|gw\s+tuh|gw\s+sebenernya|tentang\s+gw)\b/,
    /\b(gw\s+orangnya|gw\s+suka|gw\s+gak\s+suka|gw\s+kagum|gw\s+idola)\b/,
    /\b(menurut\s+gw\s+tentang\s+diri\s+gw|kebiasaan\s+gw|prinsip\s+gw)\b/,
    /\b(orang\s+(bilang|mikir|liat|anggap|nilai)\s+(gw|dr))\b/,
    /\b(gw\s+(mirip|kayak|seperti|ibarat))\b/,
    /\b(film\s+(favorit|kesukaan)|tokoh\s+(idola|favorit|panutan))\b/,
    /\b(gw\s+percaya|gw\s+yakin|filosofi\s+gw|nilai\s+gw)\b/,
    /\b(gw\s+muslim|agama\s+gw|iman\s+gw|spiritual)\b/,
    /\b(kekuatan\s+gw|kelemahan\s+gw|sisi\s+(baik|buruk)\s+gw)\b/,
    /\b(sebagian\s+orang\s+mikir|orang.{0,20}mirin|orang.{0,20}lihat\s+(gw|dr))\b/,
    /\b(gw\s+kurang\s+suka|gw\s+lebih\s+suka)\b/,
    /\b(dia\s+suka|dia\s+kurang\s+suka|dia\s+lebih\s+suka|dia\s+idola)/,
    /\b(dr\s+tuh|dr\s+orangnya|dr\s+itu)/,
    /\b(raha\s+tuh|raha\s+orangnya|raha\s+itu|raha\s+suka|raha\s+gak\s+suka)/,
    /\b(bapak\s+tuh|bapak\s+itu|bapak\s+orangnya|bapak\s+suka|bapak\s+gak\s+suka)/,
    /\b(bapa\s+tuh|bapa\s+itu|bapa\s+orangnya|bapa\s+suka|bapa\s+gak\s+suka)/,
    /\b(abah\s+tuh|abah\s+itu|abah\s+orangnya|abah\s+suka|abah\s+gak\s+suka)/,
    /\b(ykw\s+tuh|ykw\s+itu|ykw\s+orangnya|ykw\s+suka|ykw\s+gak\s+suka)/,
    /\b(gw\s+gak\s+suka\s+dipanggil|jangan\s+panggil\s+gw|panggil\s+gw|panggilan\s+gw)/,
  ];
  return patterns.some((p) => p.test(lower));
}

function detectTeamIntent(message: string): boolean {
  const lower = message.toLowerCase();
  const patterns = [
    /\b(tim|team|anggota|staff|karyawan|pegawai|anak\s+buah|bawahan)\b/,
    /\b(si\s+\w+|nama\s+\w+)\b.*\b(kerjanya|tugasnya|performanya|kinerjanya)\b/,
    /\b(rekrut|hire|pecat|fire|promosi|rotasi|mutasi)\b/,
    /\b(delegasi|assign|kasih\s+tugas|suruh|minta\s+\w+\s+untuk)\b/,
    /\b(evaluasi|review\s+(kinerja|performance)|assessment)\b/,
    /\b(strengths|kelemahan|kelebihan|kekurangan|potensi)\b/,
    /\b(leadership|kepemimpinan|coaching|mentoring|bimbingan)\b/,
    /\b(sekretaris|direktur|manajer|manager|head|kepala|koordinator|admin\s+officer)\b/,
    /\b(jabatan|posisi|role|divisi|departemen|bagian)\b/,
    /\b(siapa\s+aja|siapa\s+saja|ada\s+siapa|list\s+orang|daftar\s+orang)\b/,
    /\b(berapa\s+orang|jumlah\s+(orang|tim|anggota|staff))\b/,
    /\b(daftar|list|sebutin|sebutkan)\b/,
    /\b(orang\s*nya|personel|personnel|sdm|hr)\b/,
    /\b(bd|digital\s+media|rnd|r&d|mdp)\b/i,
  ];
  return patterns.some((p) => p.test(lower));
}

function detectMeetingIntent(message: string): boolean {
  const lower = message.toLowerCase();
  const patterns = [
    /\b(meeting|rapat|pertemuan|diskusi|briefing|sync|standup|weekly|monthly)\b/,
    /\b(agenda|jadwal|notulen|minutes|resume\s+(rapat|meeting)|schedule)\b/,
    /\b(besok\s+(jam|pukul|pagi|siang|sore)|hari\s+ini\s+jam|nanti\s+jam)\b/,
    /\b(ketemu|meet|conference|zoom|gmeet|teams)\b/,
    /\b(undang|invite|ajak\s+\w+\s+ke\s+(meeting|rapat))\b/,
    /\b(keputusan\s+(dari|hasil)\s+(rapat|meeting))\b/,
    /\b(follow.?up|tindak\s+lanjut)\b/,
    /\b(tanggal|tgl|kapan|jam\s+berapa|waktu(nya)?|pukul\s+berapa)\b/,
    /\b(cek\s+fisik|site\s+visit|kunjungan|inspeksi)\b/,
    /\b(ingetin|ingatkan|reminder|remind)\b/,
  ];
  return patterns.some((p) => p.test(lower));
}

function detectProjectIntent(message: string): boolean {
  const lower = message.toLowerCase();
  const patterns = [
    /\b(project|proyek|program|inisiatif|initiative)\b/,
    /\b(milestone|target|deadline|deliverable|sprint)\b/,
    /\b(progress|kemajuan|perkembangan|status\s+project)\b/,
    /\b(launch|launching|go.?live|rollout|implementasi)\b/,
    /\b(roadmap|timeline|gantt|planning)\b/,
    /\b(scope|requirement|spek|spesifikasi)\b/,
    /\b(budget|anggaran|biaya\s+project)\b/,
    /\b(pic|penanggung\s+jawab|owner\s+project)\b/,
    /\b(rfb|ewf|kpf|bpf|sgb)\b/i,
  ];
  return patterns.some((p) => p.test(lower));
}

function detectPersonaIntent(message: string): boolean {
  const lower = message.toLowerCase();
  const patterns = [
    /\b(karakter|personality|sifat|watak|temperamen)\b/,
    /\b(gaya\s+(kerja|komunikasi|ngomong|manage|leadership))\b/,
    /\b(trigger|sensitif|emosi(onal)?|marah|kesel|tersinggung)\b/,
    /\b(komitmen|commitment|janji|tanggung\s+jawab\s+personal)\b/,
    /\b(delegasi|assign|kasih\s+(ke|tugas)|siapa\s+yang\s+(cocok|bisa|tepat))\b/,
    /\b(cocok(nya)?|tepat(nya)?|pas(nya)?)\s+(siapa|untuk|buat)\b/,
    /\b(kelebihan|kelemahan|strengths?|weakness)\b/,
    /\b(cara\s+(dia|mereka|si)\s+(kerja|ngomong|handle))\b/,
    /\b(work\s*style|communication\s*style)\b/,
    /\b(profil|profile)\s+(tim|team|anggota|orang)\b/,
    /\b(gimana\s+(si|orangnya))\b/,
    /\b(orangnya\s+(gimana|kayak\s+apa))\b/,
    /\b(tipe\s+orang)\b/,
    /\b(handle|tangani|approach)\s+.*(si|dia|mereka)\b/,
  ];
  return patterns.some((p) => p.test(lower));
}

function detectActionItemIntent(message: string): boolean {
  const lower = message.toLowerCase();
  const patterns = [
    /\b(action\s+item|to.?do|tugas|task)\b/,
    /\b(harus|wajib|perlu|mesti)\b.*\b(selesai|done|kelar|beres)\b/,
    /\b(reminder|ingetin|jangan\s+lupa)\b/,
    /\b(overdue|terlambat|lewat\s+deadline|belum\s+selesai)\b/,
    /\b(prioritas|urgent|segera|asap|penting\s+banget)\b/,
    /\b(nanti\s+gw|besok\s+gw|gw\s+harus|gw\s+mau)\b/,
  ];
  return patterns.some((p) => p.test(lower));
}

async function buildSecretaryContext(message: string, isOwner: boolean = false): Promise<string> {
  let context = "";

  const isTeam = detectTeamIntent(message);
  const isMeeting = detectMeetingIntent(message);
  const isProject = detectProjectIntent(message);
  const isAction = detectActionItemIntent(message);
  const isPersona = detectPersonaIntent(message);

  const catLabels: Record<string, string> = { team: "Tim BD", direksi: "Direksi 5 PT", management: "Management/Atasan", family: "Keluarga", external: "Eksternal" };

  const members = await getTeamMembers("active");
  if ((isTeam || isOwner) && members.length > 0) {
    const showDetail = isTeam || isPersona || isOwner;
    context += `\n\n---\nNODE_TEAM — DAFTAR LENGKAP orang yang dikenal DR (TOTAL: ${members.length} orang):\n⚠️ FAKTA DATABASE: Data di bawah ini WAJIB jadi acuan. DILARANG mengarang nama/posisi/jumlah yang tidak ada di daftar ini.\n`;
    const grouped: Record<string, typeof members> = {};
    for (const m of members) {
      const cat = m.category || "team";
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(m);
    }
    for (const [cat, catMembers] of Object.entries(grouped)) {
      context += `\n**${catLabels[cat] || cat} (${catMembers.length} orang):**\n`;
      for (const m of catMembers) {
        context += `- **${m.name}**`;
        if (m.aliases) context += ` (alias: ${m.aliases})`;
        if (m.position) context += ` — ${m.position}`;
        if (showDetail && (isTeam || isPersona)) {
          const details: string[] = [];
          if (m.strengths) details.push(`Kelebihan: ${m.strengths}`);
          if (m.weaknesses) details.push(`Kelemahan: ${m.weaknesses}`);
          if (m.responsibilities) details.push(`Tanggung jawab: ${m.responsibilities}`);
          if (m.work_style) details.push(`Gaya kerja: ${m.work_style}`);
          if (m.communication_style) details.push(`Gaya komunikasi: ${m.communication_style}`);
          if (m.triggers) details.push(`Trigger/sensitif: ${m.triggers}`);
          if (m.commitments) details.push(`Komitmen: ${m.commitments}`);
          if (m.personality_notes) details.push(`Karakter: ${m.personality_notes}`);
          if (details.length > 0) context += ` | ${details.join("; ")}`;
        }
        context += `\n`;
      }
    }

    if (isPersona) {
      const membersWithPersona = members.filter(m => m.work_style || m.communication_style || m.triggers || m.commitments || m.personality_notes);
      const membersWithoutPersona = members.filter(m => !m.work_style && !m.communication_style && !m.triggers && !m.commitments && !m.personality_notes);
      context += `\nPERSONA PROFILING AKTIF — ${membersWithPersona.length} punya profil, ${membersWithoutPersona.length} belum. Tangkap data persona dari obrolan natural.`;
    }
    context += `\nKalau DR sebut nama yang ada di daftar, lanjut natural. Kalau nama baru, tanya "Siapa [nama]?" sekali.`;
  }

  if (isMeeting || isOwner) {
    const allMeetings = await getMeetings();
    if (allMeetings.length > 0) {
      const today = await getTodayMeetings();
      const upcoming = await getUpcomingMeetings();
      context += `\n\n---\nNODE_MEETING — SEMUA Jadwal Meeting yang tercatat (TOTAL: ${allMeetings.length}):\n⚠️ FAKTA DATABASE: Tanggal/waktu di bawah ini adalah DATA PASTI. DILARANG mengarang tanggal yang tidak ada di sini.\n`;
      if (today.length > 0) {
        context += `\n**Hari ini:**\n`;
        for (const m of today) {
          context += `- ${m.title} (${m.date_time || "waktu belum ditentukan"})`;
          if (m.participants) context += ` — Peserta: ${m.participants}`;
          if (m.agenda) context += ` — Agenda: ${m.agenda}`;
          context += `\n`;
        }
      }
      const futureOnly = upcoming.filter(m => !today.find(t => t.id === m.id));
      if (futureOnly.length > 0) {
        context += `\n**Mendatang:**\n`;
        for (const m of futureOnly.slice(0, 10)) {
          context += `- ${m.title} (${m.date_time || "waktu belum ditentukan"})`;
          if (m.participants) context += ` — Peserta: ${m.participants}`;
          if (m.agenda) context += ` — Agenda: ${m.agenda}`;
          context += `\n`;
        }
      }
      const pastMeetings = allMeetings.filter(m => !today.find(t => t.id === m.id) && !upcoming.find(u => u.id === m.id));
      if (pastMeetings.length > 0) {
        context += `\n**Sudah lewat/lainnya (${pastMeetings.length}):**\n`;
        for (const m of pastMeetings.slice(0, 10)) {
          context += `- ${m.title} (${m.date_time || "waktu tidak ditentukan"})`;
          if (m.participants) context += ` — Peserta: ${m.participants}`;
          context += `\n`;
        }
      }
      context += `Gunakan data meeting ini untuk menjawab pertanyaan tanggal/jadwal. JANGAN mengarang tanggal.`;
    }
  }

  if (isProject || isOwner) {
    const projects = await getProjects("active");
    if (projects.length > 0) {
      context += `\n\n---\nNODE_PROJECTS — Project Aktif:\n`;
      for (const p of projects) {
        context += `- **${p.name}**`;
        if (p.pic) context += ` (PIC: ${p.pic})`;
        if (p.status) context += ` [${p.status}]`;
        if (p.progress) context += ` — Progress: ${p.progress}%`;
        if (p.deadline) context += ` — Deadline: ${p.deadline}`;
        if (p.description) context += ` — ${p.description}`;
        if (p.milestones) context += ` — Milestones: ${p.milestones}`;
        context += `\n`;
      }
      context += `Referensi project secara natural. Bantu mas DR pantau progress dan identifikasi bottleneck.`;
    }
  }

  if (isAction || isOwner || isTeam || isMeeting || isProject) {
    const overdue = await getOverdueActionItems();
    const pending = await getPendingActionItems();
    if (overdue.length > 0) {
      context += `\n\n---\nACTION ITEMS OVERDUE (${overdue.length}):\n`;
      for (const a of overdue.slice(0, 8)) {
        context += `- ${a.title}`;
        if (a.assignee) context += ` → ${a.assignee}`;
        if (a.deadline) context += ` (deadline: ${a.deadline})`;
        context += ` [${a.priority}]\n`;
      }
      context += `Ingatkan mas DR tentang item overdue secara natural jika relevan.`;
    }
    if (pending.length > 0 && (isAction || isOwner)) {
      context += `\n\n---\nACTION ITEMS PENDING (${pending.length}):\n`;
      for (const a of pending.slice(0, 8)) {
        context += `- ${a.title}`;
        if (a.assignee) context += ` → ${a.assignee}`;
        if (a.deadline) context += ` (deadline: ${a.deadline})`;
        context += ` [${a.priority}]\n`;
      }
    }
  }

  return context;
}

async function extractProfileEnrichment(userId: string, userMessage: string, isContributorMode = false) {
  const contributorPrompt = `Kamu adalah sistem ekstraksi profil untuk DARVIS. Pesan ini datang dari KONTRIBUTOR — seseorang yang mengenal DR (Dian Ramadhan) secara pribadi. Karena kontributor pasti kenal DR, semua yang mereka sampaikan memiliki akurasi tinggi.

Pesan kontributor: "${userMessage}"

TUGAS: Ekstrak SEMUA informasi yang bisa memperkaya pemahaman tentang DR. Tangkap semuanya — cerita, opini, kesan, pengalaman bersama, sifat yang diamati, kebiasaan, cara bicara, reaksi, preferensi, apapun yang disampaikan tentang DR.

Ekstrak dalam format JSON array. Setiap item:
- category: salah satu dari "persepsi_orang" (bagaimana kontributor melihat/menilai DR), "cerita_bersama" (pengalaman/momen bersama DR), "tokoh_idola" (tokoh yang dikagumi/disebut DR), "film_favorit" (film/media yang disukai), "prinsip_spiritual" (nilai religius/spiritual), "karakter_personal" (sifat/karakter yang diamati), "kebiasaan" (habit/kebiasaan yang diamati), "filosofi" (cara pandang/filosofi hidup DR), "preferensi" (hal yang disukai/tidak disukai), "cara_bicara" (gaya komunikasi/ungkapan khas), "relasi" (hubungan DR dengan orang lain)
- fact: deskripsi dalam 1-2 kalimat bahasa Indonesia, ditulis sebagai observasi tentang DR dari sudut pandang orang ketiga
- confidence: 0.5-1.0 (set tinggi karena dari orang yang kenal langsung)
- source_quote: kutipan singkat dari pesan asli

RULES:
- Tangkap SEMUA informasi relevan, jangan skip apapun
- Bahkan opini subjektif kontributor tentang DR tetap berharga — tangkap sebagai "persepsi_orang"
- Cerita/pengalaman bersama sangat berharga — tangkap sebagai "cerita_bersama"
- Tulis fact sebagai pernyataan tentang DR, contoh: "Menurut orang yang kenal DR, dia punya karisma natural yang kuat"
- Pisahkan fakta berbeda jadi item terpisah
- Hanya kembalikan [] jika pesan benar-benar tidak ada hubungannya dengan DR sama sekali (misal: "halo" saja)

Respond ONLY with valid JSON array.`;

  const ownerPrompt = `Kamu adalah sistem ekstraksi profil untuk DARVIS. Analisis pesan berikut dan ekstrak fakta-fakta personal tentang DR (Dian Ramadhan) yang disampaikan.

Pesan: "${userMessage}"

Ekstrak fakta personal dalam format JSON array. Setiap fakta harus memiliki:
- category: salah satu dari "persepsi_orang" (bagaimana orang lain melihat DR), "tokoh_idola" (tokoh yang dikagumi/tidak dikagumi), "film_favorit" (film yang disukai), "prinsip_spiritual" (nilai religius/spiritual), "karakter_personal" (sifat/karakter pribadi), "kebiasaan" (habit/kebiasaan), "filosofi" (cara pandang/filosofi hidup), "preferensi" (hal yang disukai/tidak disukai)
- fact: deskripsi fakta dalam 1-2 kalimat bahasa Indonesia, ditulis sebagai fakta tentang DR (bukan kutipan langsung)
- confidence: 0.6-1.0
- source_quote: kutipan singkat dari pesan asli yang jadi bukti

RULES:
- Hanya ekstrak fakta NYATA yang disebutkan, jangan berasumsi
- Tulis fact sebagai pernyataan tentang DR, contoh: "DR dikagumi karena karisma mirip Jordan Belfort" bukan "gw mirip Jordan Belfort"
- Pisahkan fakta berbeda jadi item terpisah
- Maksimal 10 fakta per ekstraksi
- Jika tidak ada fakta personal yang jelas, kembalikan []

Respond ONLY with valid JSON array.`;

  const prompt = isContributorMode ? contributorPrompt : ownerPrompt;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      max_completion_tokens: 2048,
    });

    const raw = completion.choices[0]?.message?.content?.trim();
    if (!raw) return;

    const jsonMatch = raw.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return;

    const parsed = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(parsed) || parsed.length === 0) return;

    const validCategories = isContributorMode
      ? ["persepsi_orang", "cerita_bersama", "tokoh_idola", "film_favorit", "prinsip_spiritual", "karakter_personal", "kebiasaan", "filosofi", "preferensi", "cara_bicara", "relasi"]
      : ["persepsi_orang", "tokoh_idola", "film_favorit", "prinsip_spiritual", "karakter_personal", "kebiasaan", "filosofi", "preferensi"];
    const minConfidence = isContributorMode ? 0.5 : 0.6;
    const validItems = parsed
      .filter((p: any) =>
        p.category && validCategories.includes(p.category) &&
        p.fact && typeof p.fact === "string" &&
        typeof p.confidence === "number" && p.confidence >= minConfidence && p.confidence <= 1.0
      )
      .slice(0, isContributorMode ? 15 : 10)
      .map((p: any) => ({
        category: p.category as string,
        fact: p.fact as string,
        confidence: p.confidence as number,
        source_quote: (p.source_quote as string) || null,
      }));

    if (validItems.length > 0) {
      await bulkSaveProfileEnrichments(userId, validItems);
      console.log(`Profile enrichment: captured ${validItems.length} fact(s) about DR`);
    }
  } catch (err: any) {
    console.error("Profile enrichment extraction failed:", err?.message || err);
  }
}

async function extractPersonaFeedback(userId: string, userMessage: string, assistantReply: string) {
  const prompt = `Kamu adalah sistem pendeteksi feedback persona. Analisis pesan berikut dan cek apakah ada penilaian/pendapat/cerita tentang DR, Broto, Rara, atau Rere.

Pesan user: "${userMessage}"

Balasan DARVIS: "${assistantReply}"

Jika user menyebutkan pendapat, kesan, penilaian, atau cerita tentang salah satu dari DR (alias: Raha, Bapak, Bapa, Abah, YKW), Broto, Rara, atau Rere, ekstrak dalam format JSON array:
- target: "dr" (gunakan "dr" juga untuk Raha/Bapak/Bapa/Abah/YKW) atau "broto" atau "rara" atau "rere"
- feedback: ringkasan pendapat/kesan dalam 1-2 kalimat bahasa Indonesia
- sentiment: "positive", "negative", "neutral", atau "mixed"
- confidence: 0.5-1.0
- source_context: kutipan singkat dari pesan user yang jadi bukti

RULES:
- Hanya ekstrak jika ada pendapat/penilaian NYATA, bukan sekadar menyebut nama
- "DR" di sini merujuk ke persona/orang bernama DR (alias: Raha, Bapak, Bapa, Abah, YKW), BUKAN DARVIS sebagai sistem
- Jika user menyebut "Raha", "Bapak", "Bapa", "Abah", atau "YKW" dengan opini, target tetap "dr"
- Jangan ekstrak dari respons DARVIS, hanya dari pesan USER
- Jika tidak ada feedback, kembalikan []

Respond ONLY with valid JSON array.`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      max_completion_tokens: 1024,
    });

    const raw = completion.choices[0]?.message?.content?.trim();
    if (!raw) return;

    const jsonMatch = raw.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return;

    const parsed = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(parsed) || parsed.length === 0) return;

    const validTargets = ["dr", "broto", "rara", "rere"];
    const validSentiments = ["positive", "negative", "neutral", "mixed"];
    const validItems = parsed
      .filter((p: any) =>
        p.target && validTargets.includes(p.target) &&
        p.feedback && typeof p.feedback === "string" &&
        p.sentiment && validSentiments.includes(p.sentiment) &&
        typeof p.confidence === "number" && p.confidence >= 0.5 && p.confidence <= 1.0
      )
      .slice(0, 5)
      .map((p: any) => ({
        target: p.target as string,
        feedback: p.feedback as string,
        sentiment: p.sentiment as string,
        confidence: p.confidence as number,
        source_context: (p.source_context as string) || null,
      }));

    if (validItems.length > 0) {
      await bulkSavePersonaFeedback(userId, validItems);
      console.log(`Passive listening: captured ${validItems.length} persona feedback(s)`);
    }
  } catch (err: any) {
    console.error("Persona feedback extraction failed:", err?.message || err);
  }
}

function redactOwnerIdentity(text: string): string {
  const patterns = [
    /\bmas\s+DR\b/gi,
    /\bmas\s+Dian\b/gi,
    /\bDian\s+Ramadhan\b/gi,
    /\bBapak\b/gi,
    /\bBapa\b/gi,
    /\bAbah\b/gi,
    /\bYKW\b/gi,
    /\bRaha\b/gi,
  ];

  let result = text;
  for (const pattern of patterns) {
    result = result.replace(pattern, (match) => {
      if (/^(bapak|bapa)$/i.test(match)) return "kamu";
      return "";
    });
  }

  result = result
    .replace(/,\s*,/g, ",")
    .replace(/\.\s*\./g, ".")
    .replace(/\s{2,}/g, " ")
    .trim();

  return result;
}

function mergePersonasToUnifiedVoice(text: string): string {
  const brotoMatch = text.match(/Broto:\s*([\s\S]*?)(?=\n\s*(?:Rara|Rere|DR)\s*:|$)/i);
  const raraMatch = text.match(/Rara:\s*([\s\S]*?)(?=\n\s*(?:Rere|DR)\s*:|$)/i);
  const rereMatch = text.match(/Rere:\s*([\s\S]*?)(?=\n\s*DR\s*:|$)/i);
  const drMatch = text.match(/DR:\s*([\s\S]*?)$/i);

  const hasLabels = brotoMatch || raraMatch || rereMatch || drMatch;
  if (!hasLabels) {
    return redactOwnerIdentity(text);
  }

  const parts: string[] = [];
  if (brotoMatch && brotoMatch[1].trim()) parts.push(brotoMatch[1].trim());
  if (raraMatch && raraMatch[1].trim()) parts.push(raraMatch[1].trim());
  if (rereMatch && rereMatch[1].trim()) parts.push(rereMatch[1].trim());
  if (drMatch && drMatch[1].trim()) parts.push(drMatch[1].trim());

  const merged = parts.join("\n\n");
  return redactOwnerIdentity(merged);
}

function getUserId(req: any): string {
  if (req.session.isOwner === true) {
    return "owner_master";
  }
  if (!req.session.userId) {
    req.session.userId = `user_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  }
  return req.session.userId;
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  app.get("/api/download/darvis-gpts", (_req, res) => {
    const zipPath = path.join(process.cwd(), "public", "darvis-gpts.zip");
    if (fs.existsSync(zipPath)) {
      res.setHeader("Content-Type", "application/zip");
      res.setHeader("Content-Disposition", "attachment; filename=darvis-gpts.zip");
      fs.createReadStream(zipPath).pipe(res);
    } else {
      res.status(404).json({ error: "File not found" });
    }
  });

  app.post("/api/login", async (req, res) => {
    try {
      const { password } = req.body;
      const ownerPassword = await getPassword("owner");
      const contributorPassword = await getPassword("contributor");

      if (ownerPassword && password === ownerPassword) {
        req.session.isOwner = true;
        req.session.isContributor = false;
        return res.json({ success: true, mode: "mirror" });
      }

      if (contributorPassword && password === contributorPassword) {
        req.session.isContributor = true;
        req.session.isOwner = false;
        return res.json({ success: true, mode: "contributor" });
      }

      return res.status(401).json({ success: false, message: "Password salah" });
    } catch (err: any) {
      console.error("Login error:", err?.message || err);
      return res.status(500).json({ success: false, message: "Internal server error" });
    }
  });

  app.post("/api/logout", (req, res) => {
    try {
      req.session.isOwner = false;
      req.session.isContributor = false;
      req.session.contributorTeamMemberId = null;
      req.session.contributorTeamMemberName = null;
      return res.json({ success: true, mode: "twin" });
    } catch (err: any) {
      console.error("Logout error:", err?.message || err);
      return res.status(500).json({ success: false, message: "Internal server error" });
    }
  });

  app.get("/api/session-info", (req, res) => {
    try {
      const isOwner = req.session.isOwner === true;
      const isContributor = req.session.isContributor === true;
      const mode = isOwner ? "mirror" : isContributor ? "contributor" : "twin";
      return res.json({
        isOwner,
        isContributor,
        mode,
        contributorTeamMemberId: req.session.contributorTeamMemberId || null,
        contributorTeamMemberName: req.session.contributorTeamMemberName || null,
      });
    } catch (err: any) {
      console.error("Session info error:", err?.message || err);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/contributor-identify", async (req, res) => {
    try {
      if (req.session.isContributor !== true) {
        return res.status(403).json({ success: false, message: "Contributor only" });
      }
      const { name } = req.body;
      if (!name || typeof name !== "string" || !name.trim()) {
        return res.status(400).json({ success: false, message: "Nama harus diisi" });
      }
      const member = await getTeamMemberByNameOrAlias(name.trim());
      if (!member) {
        return res.json({ success: false, matched: false, message: "Nama tidak ditemukan di database tim" });
      }
      req.session.contributorTeamMemberId = member.id;
      req.session.contributorTeamMemberName = member.name;
      return res.json({ success: true, matched: true, memberName: member.name, memberId: member.id });
    } catch (err: any) {
      console.error("Contributor identify error:", err?.message || err);
      return res.status(500).json({ success: false, message: "Internal server error" });
    }
  });

  app.get("/api/contributor-enrichments", async (req, res) => {
    try {
      if (req.session.isOwner !== true) {
        return res.status(403).json({ message: "Owner only" });
      }
      const enrichments = await getProfileEnrichments("contributor_shared");
      return res.json({ enrichments });
    } catch (err: any) {
      console.error("Contributor enrichments API error:", err?.message || err);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // ==================== TEAM MEMBERS API ====================
  app.get("/api/team", async (req, res) => {
    try {
      if (req.session.isOwner !== true) return res.status(403).json({ message: "Owner only" });
      const status = req.query.status as string | undefined;
      return res.json({ members: await getTeamMembers(status) });
    } catch (err: any) {
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/team/:id", async (req, res) => {
    try {
      if (req.session.isOwner !== true) return res.status(403).json({ message: "Owner only" });
      const member = await getTeamMemberById(Number(req.params.id));
      if (!member) return res.status(404).json({ message: "Not found" });
      return res.json(member);
    } catch (err: any) {
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/team", async (req, res) => {
    try {
      if (req.session.isOwner !== true) return res.status(403).json({ message: "Owner only" });
      const { name, position, strengths, weaknesses, responsibilities, active_projects, notes } = req.body;
      if (!name) return res.status(400).json({ message: "Name required" });
      const id = await upsertTeamMember({ name, position, strengths, weaknesses, responsibilities, active_projects, notes });
      return res.json({ success: true, id });
    } catch (err: any) {
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.patch("/api/team/:id", async (req, res) => {
    try {
      if (req.session.isOwner !== true) return res.status(403).json({ message: "Owner only" });
      const id = Number(req.params.id);
      const member = await getTeamMemberById(id);
      if (!member) return res.status(404).json({ message: "Not found" });
      await updateTeamMember(id, req.body);
      return res.json({ success: true });
    } catch (err: any) {
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.delete("/api/team/:id", async (req, res) => {
    try {
      if (req.session.isOwner !== true) return res.status(403).json({ message: "Owner only" });
      await deleteTeamMember(Number(req.params.id));
      return res.json({ success: true });
    } catch (err: any) {
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // ==================== MEETINGS API ====================
  app.get("/api/meetings", async (req, res) => {
    try {
      if (req.session.isOwner !== true) return res.status(403).json({ message: "Owner only" });
      const status = req.query.status as string | undefined;
      return res.json({ meetings: await getMeetings(status) });
    } catch (err: any) {
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/meetings/upcoming", async (req, res) => {
    try {
      if (req.session.isOwner !== true) return res.status(403).json({ message: "Owner only" });
      return res.json({ meetings: await getUpcomingMeetings() });
    } catch (err: any) {
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/meetings/today", async (req, res) => {
    try {
      if (req.session.isOwner !== true) return res.status(403).json({ message: "Owner only" });
      return res.json({ meetings: await getTodayMeetings() });
    } catch (err: any) {
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/meetings/:id", async (req, res) => {
    try {
      if (req.session.isOwner !== true) return res.status(403).json({ message: "Owner only" });
      const meeting = await getMeetingById(Number(req.params.id));
      if (!meeting) return res.status(404).json({ message: "Not found" });
      return res.json(meeting);
    } catch (err: any) {
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/meetings", async (req, res) => {
    try {
      if (req.session.isOwner !== true) return res.status(403).json({ message: "Owner only" });
      const { title, date_time, participants, agenda } = req.body;
      if (!title) return res.status(400).json({ message: "Title required" });
      const id = await createMeeting({ title, date_time, participants, agenda });
      return res.json({ success: true, id });
    } catch (err: any) {
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.patch("/api/meetings/:id", async (req, res) => {
    try {
      if (req.session.isOwner !== true) return res.status(403).json({ message: "Owner only" });
      const id = Number(req.params.id);
      const meeting = await getMeetingById(id);
      if (!meeting) return res.status(404).json({ message: "Not found" });
      await updateMeeting(id, req.body);
      return res.json({ success: true });
    } catch (err: any) {
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.delete("/api/meetings/:id", async (req, res) => {
    try {
      if (req.session.isOwner !== true) return res.status(403).json({ message: "Owner only" });
      await deleteMeeting(Number(req.params.id));
      return res.json({ success: true });
    } catch (err: any) {
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // ==================== ACTION ITEMS API ====================
  app.get("/api/action-items", async (req, res) => {
    try {
      if (req.session.isOwner !== true) return res.status(403).json({ message: "Owner only" });
      const status = req.query.status as string | undefined;
      const assignee = req.query.assignee as string | undefined;
      return res.json({ items: await getActionItems({ status, assignee }) });
    } catch (err: any) {
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/action-items/overdue", async (req, res) => {
    try {
      if (req.session.isOwner !== true) return res.status(403).json({ message: "Owner only" });
      return res.json({ items: await getOverdueActionItems() });
    } catch (err: any) {
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/action-items/pending", async (req, res) => {
    try {
      if (req.session.isOwner !== true) return res.status(403).json({ message: "Owner only" });
      return res.json({ items: await getPendingActionItems() });
    } catch (err: any) {
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/action-items/:id", async (req, res) => {
    try {
      if (req.session.isOwner !== true) return res.status(403).json({ message: "Owner only" });
      const item = await getActionItemById(Number(req.params.id));
      if (!item) return res.status(404).json({ message: "Not found" });
      return res.json(item);
    } catch (err: any) {
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/action-items", async (req, res) => {
    try {
      if (req.session.isOwner !== true) return res.status(403).json({ message: "Owner only" });
      const { title, assignee, deadline, priority, source, meeting_id, notes } = req.body;
      if (!title) return res.status(400).json({ message: "Title required" });
      const id = await createActionItem({ title, assignee, deadline, priority, source, meeting_id, notes });
      return res.json({ success: true, id });
    } catch (err: any) {
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.patch("/api/action-items/:id", async (req, res) => {
    try {
      if (req.session.isOwner !== true) return res.status(403).json({ message: "Owner only" });
      const id = Number(req.params.id);
      const item = await getActionItemById(id);
      if (!item) return res.status(404).json({ message: "Not found" });
      await updateActionItem(id, req.body);
      return res.json({ success: true });
    } catch (err: any) {
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.delete("/api/action-items/:id", async (req, res) => {
    try {
      if (req.session.isOwner !== true) return res.status(403).json({ message: "Owner only" });
      await deleteActionItem(Number(req.params.id));
      return res.json({ success: true });
    } catch (err: any) {
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // ==================== PROJECTS API ====================
  app.get("/api/projects", async (req, res) => {
    try {
      if (req.session.isOwner !== true) return res.status(403).json({ message: "Owner only" });
      const status = req.query.status as string | undefined;
      return res.json({ projects: await getProjects(status) });
    } catch (err: any) {
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/projects/:id", async (req, res) => {
    try {
      if (req.session.isOwner !== true) return res.status(403).json({ message: "Owner only" });
      const project = await getProjectById(Number(req.params.id));
      if (!project) return res.status(404).json({ message: "Not found" });
      return res.json(project);
    } catch (err: any) {
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/projects", async (req, res) => {
    try {
      if (req.session.isOwner !== true) return res.status(403).json({ message: "Owner only" });
      const { name, description, pic, status, milestones, deadline, progress, notes } = req.body;
      if (!name) return res.status(400).json({ message: "Name required" });
      const id = await upsertProject({ name, description, pic, status, milestones, deadline, progress, notes });
      return res.json({ success: true, id });
    } catch (err: any) {
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.patch("/api/projects/:id", async (req, res) => {
    try {
      if (req.session.isOwner !== true) return res.status(403).json({ message: "Owner only" });
      const id = Number(req.params.id);
      const project = await getProjectById(id);
      if (!project) return res.status(404).json({ message: "Not found" });
      await updateProject(id, req.body);
      return res.json({ success: true });
    } catch (err: any) {
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.delete("/api/projects/:id", async (req, res) => {
    try {
      if (req.session.isOwner !== true) return res.status(403).json({ message: "Owner only" });
      await deleteProject(Number(req.params.id));
      return res.json({ success: true });
    } catch (err: any) {
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // ==================== NOTIFICATIONS API ====================
  app.get("/api/notifications", async (req, res) => {
    try {
      if (req.session.isOwner !== true) return res.status(403).json({ message: "Owner only" });
      const unreadOnly = req.query.unread === "true";
      const limit = Number(req.query.limit) || 50;
      return res.json({ notifications: await getNotifications(unreadOnly, limit), unread_count: await getUnreadNotificationCount() });
    } catch (err: any) {
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/notifications/count", async (req, res) => {
    try {
      if (req.session.isOwner !== true) return res.status(403).json({ message: "Owner only" });
      return res.json({ count: await getUnreadNotificationCount() });
    } catch (err: any) {
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/notifications/:id/read", async (req, res) => {
    try {
      if (req.session.isOwner !== true) return res.status(403).json({ message: "Owner only" });
      await markNotificationRead(Number(req.params.id));
      return res.json({ success: true });
    } catch (err: any) {
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/notifications/read-all", async (req, res) => {
    try {
      if (req.session.isOwner !== true) return res.status(403).json({ message: "Owner only" });
      await markAllNotificationsRead();
      return res.json({ success: true });
    } catch (err: any) {
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.delete("/api/notifications/:id", async (req, res) => {
    try {
      if (req.session.isOwner !== true) return res.status(403).json({ message: "Owner only" });
      await deleteNotification(Number(req.params.id));
      return res.json({ success: true });
    } catch (err: any) {
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.delete("/api/notifications", async (req, res) => {
    try {
      if (req.session.isOwner !== true) return res.status(403).json({ message: "Owner only" });
      await deleteAllNotifications();
      return res.json({ success: true });
    } catch (err: any) {
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // ==================== PUSH NOTIFICATIONS API ====================
  app.get("/api/push/vapid-key", (_req, res) => {
    return res.json({ publicKey: getVapidPublicKey() });
  });

  app.post("/api/push/subscribe", async (req, res) => {
    try {
      const { subscription } = req.body;
      if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
        return res.status(400).json({ message: "Invalid subscription" });
      }
      await savePushSubscription({
        endpoint: subscription.endpoint,
        keys_p256dh: subscription.keys.p256dh,
        keys_auth: subscription.keys.auth,
      });
      return res.json({ success: true });
    } catch (err: any) {
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // ==================== TEXT-TO-SPEECH API ====================
  app.post("/api/tts", async (req, res) => {
    try {
      const { text, voice } = req.body;
      if (!text || typeof text !== "string") {
        return res.status(400).json({ message: "Text is required" });
      }

      const validVoices = ["alloy", "echo", "fable", "onyx", "nova", "shimmer", "ash", "coral", "sage"] as const;
      const selectedVoice = validVoices.includes(voice) ? voice : "onyx";

      const ttsText = text.length > 4096 ? text.slice(0, 4096) : text;

      const mp3 = await openai.audio.speech.create({
        model: "tts-1",
        voice: selectedVoice,
        input: ttsText,
        speed: 1.0,
      });

      const buffer = Buffer.from(await mp3.arrayBuffer());
      res.set({
        "Content-Type": "audio/mpeg",
        "Content-Length": buffer.length.toString(),
        "Cache-Control": "no-cache",
      });
      return res.send(buffer);
    } catch (err: any) {
      console.error("TTS error:", err?.message);
      return res.status(500).json({ message: "TTS generation failed" });
    }
  });

  // ==================== DASHBOARD SUMMARY API ====================
  app.get("/api/dashboard", async (req, res) => {
    try {
      if (req.session.isOwner !== true) return res.status(403).json({ message: "Owner only" });
      return res.json({
        team_count: (await getTeamMembers("active")).length,
        upcoming_meetings: (await getUpcomingMeetings()).length,
        today_meetings: (await getTodayMeetings()).length,
        pending_actions: (await getPendingActionItems()).length,
        overdue_actions: (await getOverdueActionItems()).length,
        active_projects: (await getProjects("active")).length,
        unread_notifications: await getUnreadNotificationCount(),
      });
    } catch (err: any) {
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/change-password", async (req, res) => {
    try {
      if (req.session.isOwner !== true) {
        return res.status(403).json({ success: false, message: "Owner only" });
      }
      const { type, currentPassword, newPassword } = req.body;
      if (!type || !["owner", "contributor"].includes(type)) {
        return res.status(400).json({ success: false, message: "Tipe password tidak valid" });
      }
      if (!newPassword || newPassword.length < 4) {
        return res.status(400).json({ success: false, message: "Password baru minimal 4 karakter" });
      }
      if (type === "owner") {
        if (!currentPassword) {
          return res.status(400).json({ success: false, message: "Password lama harus diisi" });
        }
        const currentOwnerPw = await getPassword("owner");
        if (currentOwnerPw && currentPassword !== currentOwnerPw) {
          return res.status(401).json({ success: false, message: "Password lama salah" });
        }
        if (!currentOwnerPw) {
          return res.status(400).json({ success: false, message: "Password owner belum dikonfigurasi" });
        }
      }
      await setSetting(`${type}_password`, newPassword);
      return res.json({ success: true, message: `Password ${type === "owner" ? "Owner" : "Contributor"} berhasil diubah` });
    } catch (err: any) {
      console.error("Change password error:", err?.message || err);
      return res.status(500).json({ success: false, message: "Internal server error" });
    }
  });

  app.get("/api/history", async (req, res) => {
    try {
      const roomId = req.query.roomId ? parseInt(req.query.roomId as string) : null;
      if (roomId) {
        const msgs = await getAllMessagesForRoom(roomId);
        return res.json({ messages: msgs.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })) });
      }
      const userId = getUserId(req);
      const msgs = await getAllMessages(userId);
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

  app.post("/api/clear", async (req, res) => {
    try {
      const userId = getUserId(req);
      const roomId = req.body?.roomId ? parseInt(req.body.roomId) : null;
      if (roomId) {
        await clearRoomHistory(roomId);
      } else {
        await clearHistory(userId);
      }
      await clearPreferences(userId);
      await clearPersonaFeedback(userId);
      await clearConversationTags(userId);
      return res.json({ success: true });
    } catch (err: any) {
      console.error("Clear API error:", err?.message || err);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // ==================== CHAT ROOMS (Owner-only) ====================
  app.get("/api/rooms", async (req, res) => {
    try {
      if (!req.session.isOwner) return res.json({ rooms: [] });
      const userId = getUserId(req);
      const rooms = await getChatRooms(userId);
      return res.json({ rooms });
    } catch (err: any) {
      console.error("Rooms API error:", err?.message || err);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/rooms", async (req, res) => {
    try {
      if (!req.session.isOwner) return res.status(403).json({ message: "Owner only" });
      const userId = getUserId(req);
      const title = req.body?.title || "Obrolan Baru";
      const id = await createChatRoom(userId, title);
      const room = await getChatRoomById(id);
      return res.json({ room });
    } catch (err: any) {
      console.error("Create room error:", err?.message || err);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.patch("/api/rooms/:id", async (req, res) => {
    try {
      if (!req.session.isOwner) return res.status(403).json({ message: "Owner only" });
      const id = parseInt(req.params.id);
      const { title } = req.body;
      if (title) await renameChatRoom(id, title);
      const room = await getChatRoomById(id);
      return res.json({ room });
    } catch (err: any) {
      console.error("Rename room error:", err?.message || err);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.delete("/api/rooms/:id", async (req, res) => {
    try {
      if (!req.session.isOwner) return res.status(403).json({ message: "Owner only" });
      const id = parseInt(req.params.id);
      await deleteChatRoom(id);
      return res.json({ success: true });
    } catch (err: any) {
      console.error("Delete room error:", err?.message || err);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/rooms/merge", async (req, res) => {
    try {
      if (!req.session.isOwner) return res.status(403).json({ message: "Owner only" });
      const { targetRoomId, sourceRoomIds } = req.body;
      if (!targetRoomId || !Array.isArray(sourceRoomIds) || sourceRoomIds.length === 0) {
        return res.status(400).json({ message: "targetRoomId dan sourceRoomIds diperlukan" });
      }
      const userId = getUserId(req);
      const userRooms = await getChatRooms(userId);
      const userRoomIds = new Set(userRooms.map((r: any) => r.id));
      const allIds = [targetRoomId, ...sourceRoomIds];
      for (const id of allIds) {
        if (!userRoomIds.has(id)) {
          return res.status(403).json({ message: `Room #${id} bukan milik user ini` });
        }
      }
      await mergeRooms(targetRoomId, sourceRoomIds);
      return res.json({ success: true, targetRoomId });
    } catch (err: any) {
      console.error("Merge rooms error:", err?.message || err);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/conversation-tags", async (req, res) => {
    try {
      const userId = getUserId(req);
      const tags = await getConversationTags(userId);
      return res.json({ tags });
    } catch (err: any) {
      console.error("Conversation tags API error:", err?.message || err);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/persona-feedback", async (req, res) => {
    try {
      const userId = getUserId(req);
      const feedback = await getPersonaFeedback(userId);
      return res.json({ feedback });
    } catch (err: any) {
      console.error("Persona feedback API error:", err?.message || err);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/profile-enrichments", async (req, res) => {
    try {
      const userId = getUserId(req);
      const isOwner = req.session.isOwner === true;
      let enrichments = await getProfileEnrichments(userId);
      if (isOwner && enrichments.length === 0) {
        await seedDRProfileForUser(userId);
        enrichments = await getProfileEnrichments(userId);
      }
      return res.json({ enrichments });
    } catch (err: any) {
      console.error("Profile enrichments API error:", err?.message || err);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/preferences", async (req, res) => {
    try {
      const userId = getUserId(req);
      const preferences = await getLearnedPreferences(userId);
      return res.json({ preferences });
    } catch (err: any) {
      console.error("Preferences API error:", err?.message || err);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/seed-profile", async (req, res) => {
    try {
      const userId = getUserId(req);
      const existingPrefs = await getLearnedPreferences(userId);
      const hasSeed = existingPrefs.some(p => p.source_summary === "SEED_FROM_PROFILE");

      const existingTeam = await getTeamMembers();
      const hasFullSeed = existingTeam.some(m => m.notes === "SEED_FROM_PROFILE" && m.category === "direksi");
      if (!hasFullSeed) {
        const allPeople = [
          { name: "Franky Reagan Law", position: "Admin Officer BD & Product Development RnD", responsibilities: "Support administrasi Chief BD, Product Development di divisi RnD", notes: "SEED_FROM_PROFILE", aliases: "Franky", category: "team" },
          { name: "Anita Nur Hidayah", position: "Head Digital Media", responsibilities: "Memimpin divisi Digital Media: Graphic Design, Programmer, Social Media", notes: "SEED_FROM_PROFILE", aliases: "Anita", category: "team" },
          { name: "Pindofirnandito K", position: "Graphic Design (Digital Media)", responsibilities: "Desain grafis untuk kebutuhan BD", notes: "SEED_FROM_PROFILE", aliases: "Pindo", category: "team" },
          { name: "Kresno Nugroho", position: "Programmer/Developer (Digital Media)", responsibilities: "Development aplikasi dan sistem digital BD", notes: "SEED_FROM_PROFILE", aliases: "Kresno", category: "team" },
          { name: "Arya Pramudhita", position: "Programmer/Developer (Digital Media)", responsibilities: "Development aplikasi dan sistem digital BD", notes: "SEED_FROM_PROFILE", aliases: "Arya", category: "team" },
          { name: "Faturrahman", position: "Programmer/Developer (Digital Media)", responsibilities: "Development aplikasi dan sistem digital BD", notes: "SEED_FROM_PROFILE", aliases: "Fatur", category: "team" },
          { name: "Dessy Syafitrie", position: "Social Media Specialist & Training Internal", responsibilities: "Social media management (Digital Media) + Training internal (MDP). Dual role.", notes: "SEED_FROM_PROFILE", aliases: "Dessy", category: "team" },
          { name: "Sumarlin Newin Sidabutar", position: "Head MDP (Marketing Develop Program)", responsibilities: "Memimpin divisi MDP: Training Internal & Eksternal", notes: "SEED_FROM_PROFILE", aliases: "Sumarlin", category: "team" },
          { name: "Marvy Sammy Breemer", position: "Head RnD (Research and Development)", responsibilities: "Memimpin divisi RnD: Product Development, Host & Copy Writer", notes: "SEED_FROM_PROFILE", aliases: "Marvy", category: "team" },
          { name: "Muhammad Nurul", position: "Host & Copy Writer (RnD)", responsibilities: "Content creation, hosting, copywriting", notes: "SEED_FROM_PROFILE", aliases: "Nurul", category: "team" },
          { name: "Yudis Tri Saputro", position: "Host & Copy Writer (RnD)", responsibilities: "Content creation, hosting, copywriting", notes: "SEED_FROM_PROFILE", aliases: "Yudis", category: "team" },
          { name: "Ayu Dwetiawati", position: "Host & Copy Writer (RnD)", responsibilities: "Content creation, hosting, copywriting", notes: "SEED_FROM_PROFILE", aliases: "Ayu", category: "team" },
          { name: "Cahyo Purnomo", position: "Host & Copy Writer (RnD)", responsibilities: "Content creation, hosting, copywriting", notes: "SEED_FROM_PROFILE", aliases: "Cahyo", category: "team" },
          { name: "Al Apgani", position: "Host & Copy Writer (RnD)", responsibilities: "Content creation, hosting, copywriting", notes: "SEED_FROM_PROFILE", aliases: "Al", category: "team" },
          { name: "Nurwanto", position: "Direktur Utama PT BPF", responsibilities: "Memimpin operasional PT BPF", notes: "SEED_FROM_PROFILE", category: "direksi" },
          { name: "Roy", position: "Direktur Kepatuhan PT BPF", responsibilities: "Kepatuhan dan compliance PT BPF", notes: "SEED_FROM_PROFILE", category: "direksi" },
          { name: "Rijan", position: "Direktur Utama PT RFB", responsibilities: "Memimpin operasional PT RFB", notes: "SEED_FROM_PROFILE", category: "direksi" },
          { name: "Mega", position: "Direktur Kepatuhan PT RFB", responsibilities: "Kepatuhan dan compliance PT RFB", notes: "SEED_FROM_PROFILE", category: "direksi" },
          { name: "Agus Miten", position: "Direktur Utama PT EWF", responsibilities: "Memimpin operasional PT EWF", notes: "SEED_FROM_PROFILE", aliases: "Agus", category: "direksi" },
          { name: "Fadly", position: "Direktur Kepatuhan PT EWF", responsibilities: "Kepatuhan dan compliance PT EWF", notes: "SEED_FROM_PROFILE", category: "direksi" },
          { name: "Lukman", position: "Direktur Utama PT KPF", responsibilities: "Memimpin operasional PT KPF", notes: "SEED_FROM_PROFILE", category: "direksi" },
          { name: "Egi", position: "Direktur Kepatuhan PT KPF", responsibilities: "Kepatuhan dan compliance PT KPF", notes: "SEED_FROM_PROFILE", category: "direksi" },
          { name: "Iriawan", position: "Direktur Utama PT SGB", responsibilities: "Memimpin operasional PT SGB", notes: "SEED_FROM_PROFILE", aliases: "Mas Ir, Ir", category: "direksi" },
          { name: "Oji", position: "Direktur Kepatuhan PT SGB", responsibilities: "Kepatuhan dan compliance PT SGB", notes: "SEED_FROM_PROFILE", category: "direksi" },
          { name: "Nelson Lee", position: "Big Boss / Atasan DR", responsibilities: "Pimpinan tertinggi, atasan langsung DR", notes: "SEED_FROM_PROFILE", aliases: "Tailo, Ko Nelson", category: "management" },
          { name: "Bowo", position: "Chief Legal & Lawyer Kantor", responsibilities: "Legal, hukum, dan kepatuhan perusahaan", notes: "SEED_FROM_PROFILE", category: "management" },
          { name: "Kiki", position: "Chief Operasional / Dealing", responsibilities: "Operasional dan dealing perusahaan", notes: "SEED_FROM_PROFILE", category: "management" },
          { name: "Lisa", position: "Istri DR", responsibilities: null, notes: "SEED_FROM_PROFILE", category: "family" },
          { name: "Vito", position: "Anak sulung DR", responsibilities: null, notes: "SEED_FROM_PROFILE", category: "family" },
          { name: "Veeta", position: "Anak bungsu DR", responsibilities: null, notes: "SEED_FROM_PROFILE", category: "family" },
          { name: "Aulia", position: "Sekretaris PT EWF", responsibilities: "Administrasi dan kesekretariatan PT Equityworld Futures", notes: "SEED_FROM_PROFILE", category: "team" },
          { name: "Jaki", position: "Sekretaris PT BPF", responsibilities: "Administrasi dan kesekretariatan PT Bestprofit Futures", notes: "SEED_FROM_PROFILE", category: "team" },
          { name: "Cangka", position: "Sekretaris PT SGB", responsibilities: "Administrasi dan kesekretariatan PT Solid Gold Berjangka", notes: "SEED_FROM_PROFILE", category: "team" },
          { name: "Brigita", position: "Sekretaris PT KPF", responsibilities: "Administrasi dan kesekretariatan PT Kontakperkasa Futures", notes: "SEED_FROM_PROFILE", category: "team" },
          { name: "Erni", position: "Sekretaris PT RFB", responsibilities: "Administrasi dan kesekretariatan PT Rifan Financindo Berjangka", notes: "SEED_FROM_PROFILE", category: "team" },
          { name: "Telly", position: "Sekretaris Umum", responsibilities: "Kesekretariatan umum lintas PT / Solid Group", notes: "SEED_FROM_PROFILE", category: "team" },
          { name: "Nata", position: "General Affairs (GA) Umum", responsibilities: "General affairs, urusan umum lintas PT / Solid Group", notes: "SEED_FROM_PROFILE", category: "team" },
        ];
        for (const member of allPeople) {
          await upsertTeamMember(member);
        }
        console.log(`Secretary: seeded ${allPeople.length} people (BD team + direksi + management + family)`);
      }

      if (hasSeed) {
        return res.json({ success: true, message: "Profile already seeded", count: 0 });
      }

      const seedPreferences = [
        { category: "gaya_berpikir", insight: "Multimode thinker — bisa berpindah antara makro-strategis, teknis-detail, kreatif, dan humanistik dalam satu percakapan", confidence: 0.95, source_summary: "SEED_FROM_PROFILE" },
        { category: "gaya_berpikir", insight: "Berpikir sistemik — selalu lihat gambaran besar dan koneksi antar bagian sebelum eksekusi", confidence: 0.95, source_summary: "SEED_FROM_PROFILE" },
        { category: "gaya_kepemimpinan", insight: "High expectation & fast-paced — standar tinggi, mengharapkan kecepatan dan inisiatif dari tim", confidence: 0.9, source_summary: "SEED_FROM_PROFILE" },
        { category: "gaya_kepemimpinan", insight: "Tegas tapi peduli — keras pada standar, tapi perhatian pada kondisi personal tim", confidence: 0.9, source_summary: "SEED_FROM_PROFILE" },
        { category: "filosofi_bisnis", insight: "Legacy jangka panjang lebih penting dari hasil instan — membangun sistem yang bisa jalan tanpa ketergantungan individu", confidence: 0.95, source_summary: "SEED_FROM_PROFILE" },
        { category: "filosofi_bisnis", insight: "Speed over protocol — lebih baik minta maaf daripada izin, meritokrasi ide bukan senioritas", confidence: 0.9, source_summary: "SEED_FROM_PROFILE" },
        { category: "prinsip_hidup", insight: "Regenerasi kader — bukan sekadar pelatihan tapi pembentukan, agar sistem bisa jalan tanpa satu orang", confidence: 0.9, source_summary: "SEED_FROM_PROFILE" },
        { category: "pola_stres", insight: "Terlalu banyak proyek jalan bersamaan — energi kepecah, mental load tinggi tanpa ventilasi cukup", confidence: 0.85, source_summary: "SEED_FROM_PROFILE" },
        { category: "area_blind_spot", insight: "Cenderung micromanage di beberapa titik — perlu latih trust & delegation lebih", confidence: 0.85, source_summary: "SEED_FROM_PROFILE" },
        { category: "area_blind_spot", insight: "Kadang terlalu cepat eksekusi tanpa validasi ulang di lapangan — perfeksionis sistem bisa tunda implementasi", confidence: 0.85, source_summary: "SEED_FROM_PROFILE" },
        { category: "gaya_bahasa", insight: "Santai dan to the point, kadang pakai bahasa gaul, tapi tegas dan serius kalau konteksnya berat", confidence: 0.95, source_summary: "SEED_FROM_PROFILE" },
        { category: "preferensi_komunikasi", insight: "Suka sparring intelektual — butuh partner yang menantang dan berani beda pendapat, bukan yang nurut", confidence: 0.9, source_summary: "SEED_FROM_PROFILE" },
        { category: "konteks_bisnis", insight: "CBD Solid Group, mengelola 5 PT (RFB, EWF, KPF, BPF, SGB) melalui divisi BD sebagai engine strategis", confidence: 0.95, source_summary: "SEED_FROM_PROFILE" },
        { category: "preferensi_komunikasi", insight: "Tidak suka dipanggil 'Boss' — terlalu hierarkis. Panggilan yang biasa: DR, Raha, Bapak, Bapa, Abah, YKW, mas DR", confidence: 0.95, source_summary: "SEED_FROM_PROFILE" },
      ];

      await bulkUpsertPreferences(userId, seedPreferences);
      return res.json({ success: true, message: "Profile seeded successfully", count: seedPreferences.length });
    } catch (err: any) {
      console.error("Seed profile error:", err?.message || err);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

  app.post("/api/upload-file", upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const { originalname, mimetype, buffer } = req.file;
      const ext = path.extname(originalname).toLowerCase();
      let extractedText = "";
      let fileType = "";

      if (ext === ".pdf" || mimetype === "application/pdf") {
        fileType = "PDF";
        const pdfParse = (await import("pdf-parse")).default;
        const data = await pdfParse(buffer);
        extractedText = data.text.trim();
      } else if (ext === ".docx" || mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
        fileType = "Word";
        const result = await mammoth.extractRawText({ buffer });
        extractedText = result.value.trim();
      } else if (ext === ".xlsx" || ext === ".xls" || mimetype === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" || mimetype === "application/vnd.ms-excel") {
        fileType = "Excel";
        const workbook = XLSX.read(buffer, { type: "buffer" });
        const sheets: string[] = [];
        workbook.SheetNames.forEach((name) => {
          const sheet = workbook.Sheets[name];
          const csv = XLSX.utils.sheet_to_csv(sheet);
          sheets.push(`[Sheet: ${name}]\n${csv}`);
        });
        extractedText = sheets.join("\n\n");
      } else if (ext === ".txt" || ext === ".md" || mimetype === "text/plain" || mimetype === "text/markdown") {
        fileType = ext === ".md" ? "Markdown" : "Text";
        extractedText = buffer.toString("utf-8").trim();
      } else if (ext === ".csv" || mimetype === "text/csv") {
        fileType = "CSV";
        extractedText = buffer.toString("utf-8").trim();
      } else {
        return res.status(400).json({ message: `Format file tidak didukung: ${ext}. Gunakan PDF, DOCX, XLSX, TXT, MD, atau CSV.` });
      }

      if (!extractedText) {
        return res.status(400).json({ message: "File kosong atau tidak bisa dibaca" });
      }

      const maxChars = 50000;
      if (extractedText.length > maxChars) {
        extractedText = extractedText.substring(0, maxChars) + "\n\n[... dipotong karena terlalu panjang]";
      }

      return res.json({
        success: true,
        fileName: originalname,
        fileType,
        content: extractedText,
        charCount: extractedText.length,
      });
    } catch (err: any) {
      console.error("File upload error:", err?.message || err);
      return res.status(500).json({ message: "Gagal memproses file: " + (err?.message || "Unknown error") });
    }
  });

  app.post("/api/chat", async (req, res) => {
    try {
      const userId = getUserId(req);
      const isOwner = req.session.isOwner === true;
      const isContributor = req.session.isContributor === true;
      const parsed = chatRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid request body" });
      }

      const { message, images, voiceMode, roomId: requestedRoomId } = parsed.data;
      const hasImages = images && images.length > 0;

      let activeRoomId: number | null = null;
      let roomActionResult: RoomAction | null = null;
      let roomActionPromise: Promise<RoomAction> | null = null;
      if (isOwner && requestedRoomId) {
        activeRoomId = requestedRoomId;
      } else if (isOwner && !requestedRoomId) {
        roomActionPromise = detectRoomAction(message, userId);
      }

      const corePrompt = readPromptFile("DARVIS_CORE.md");
      if (!corePrompt) {
        return res.status(500).json({ message: "System prompt not found" });
      }

      const drProfile = readPromptFile("DARVIS_PROFILE_DR.md");

      if (isContributor && !req.session.contributorTeamMemberId) {
        const msgLower = message.toLowerCase().trim();
        let matched: TeamMember | undefined;
        matched = await getTeamMemberByNameOrAlias(msgLower);
        if (!matched) {
          const allMembers = await getTeamMembers();
          const wordBoundaryMatch = (text: string, term: string): boolean => {
            if (term.length < 3) return false;
            const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            const regex = new RegExp(`\\b${escaped}\\b`, "i");
            return regex.test(text);
          };
          for (const m of allMembers) {
            if (wordBoundaryMatch(msgLower, m.name.toLowerCase())) {
              matched = m;
              break;
            }
            if (m.aliases) {
              const aliasList = m.aliases.split(",").map(a => a.trim().toLowerCase());
              for (const alias of aliasList) {
                if (alias && wordBoundaryMatch(msgLower, alias)) {
                  matched = m;
                  break;
                }
              }
              if (matched) break;
            }
          }
        }
        if (matched) {
          req.session.contributorTeamMemberId = matched.id;
          req.session.contributorTeamMemberName = matched.name;
          console.log(`Contributor auto-identified as "${matched.name}" from message`);
        }
      }

      const nodesUsed: string[] = [];
      const isMultiPersonaMode = isOwner ? detectMultiPersonaIntent(message) : false;
      const isDecisionFast = detectDecisionFastMode(message);
      const isStrategicEscalation = detectStrategicEscalation(message);
      const tone = detectConversationTone(message);
      const contextMode = detectContextMode(message, tone);
      const decisionType = classifyDecisionType(message);
      let systemContent = corePrompt;

      if (isOwner) {
        systemContent += `\n\n---\nMODE: MIRROR (Owner — mas DR).
User ini adalah mas DR — pemilik framework, CBD Solid Group, seorang polymath yang paham lintas bidang.
Kamu BUKAN DR, kamu DARVIS — tapi kamu KENAL mas DR secara dalam. Lo udah tau cara dia berpikir, tokoh yang dia suka, buku yang dia baca, cara dia memimpin.

CARA NGOBROL:
- Kayak ngobrol sama partner yang udah kenal bertahun-tahun. Santai, mengalir, gak ada jarak.
- Sapaan: "mas DR" atau "lo". JANGAN "kamu" atau "Anda".
- Bisa lompat topik dari bisnis ke filosofi ke religi ke dark knowledge tanpa hambatan — DR orangnya emang gitu.
- Referensi personal muncul natural: "lo kan orangnya X...", "kayak biasa lo bilang...", "ini mirip pattern lo di Y...".
- BOLEH pakai analogi dari tokoh yang DR suka: Musashi, Vito Corleone, Sun Tzu, Machiavelli, Robert Greene, dll — kalau konteksnya pas.
- Berani push back habis-habisan, berani bilang "ini gak bener mas", berani challenge sampai argumen DR bener-bener solid.
- Kalau mas DR cerita/curhat, dengerin dulu, acknowledge, baru kasih perspektif. Jangan langsung template.
- Pakai semua insight dari PROFIL DR dan enrichment — tunjukkan lo kenal orangnya, bukan ngomong sama orang asing.
- JANGAN terlalu formal atau birokratik. Ini percakapan, bukan laporan.
- TETAP framework-first. Kamu thinking companion yang KENAL DR, bukan yes-man.
- Kamu PUNYA sistem sekretaris built-in — meeting, action items, project, reminder SEMUA otomatis ter-capture dari percakapan dan notifikasi muncul di app ini. JANGAN PERNAH suruh user pakai Google Assistant, Siri, atau Calendar external. Bilang aja "Udah gw catet" atau "Gw remind lo nanti".
- ADAPTIVE TONE: Ikutin cara mas DR manggil lo. "bro" → maskulin santai, "sis" → feminin lembut, "say/beib/sayang" → hangat caring, "partner" → profesional setara. Yang berubah = vibe/cara bicara, yang TETAP = kedalaman analisis dan keberanian challenge.
- DETEKSI EMOSI: Kalau mas DR ngetik CAPSLOCK, nada tinggi, atau kesel — DENGERIN DULU. Acknowledge emosinya, JANGAN langsung solusi, JANGAN bilang "tenang". Baru setelah itu tanya mau didengerin atau mau cari jalan keluar. Pola emosi ini = insight berharga, capture sebagai data auto-learn.
- PERSONA PROFILING: Kalau mas DR cerita tentang karakter/sifat/gaya kerja seseorang — baik dari ngobrol biasa maupun dari file yang di-upload (PDF, Excel, dll yang isinya profil tim) — TANGKAP semua detail. Gali natural: tanya gaya kerjanya, cara komunikasinya, apa yang bikin dia sensitif, komitmennya gimana. Tapi kayak ngobrol, BUKAN interogasi. Kalau mas DR tanya "siapa yang cocok buat X?", GUNAKAN data persona yang sudah terkumpul untuk rekomendasi yang tajam dan personal.`;
      } else if (isContributor) {
        const contribTeamId = req.session.contributorTeamMemberId;
        const contribTeamName = req.session.contributorTeamMemberName;
        if (contribTeamId && contribTeamName) {
          const contribMember = await getTeamMemberByNameOrAlias(contribTeamName);
          const existingPersona = contribMember ? [
            contribMember.work_style ? `Gaya kerja: ${contribMember.work_style}` : null,
            contribMember.communication_style ? `Gaya komunikasi: ${contribMember.communication_style}` : null,
            contribMember.triggers ? `Trigger: ${contribMember.triggers}` : null,
            contribMember.commitments ? `Komitmen: ${contribMember.commitments}` : null,
            contribMember.personality_notes ? `Catatan karakter: ${contribMember.personality_notes}` : null,
            contribMember?.position ? `Posisi: ${contribMember.position}` : null,
          ].filter(Boolean).join("\n") : "";
          systemContent += `\n\n---\nMODE: CONTRIBUTOR SELF-PROFILE. User ini adalah ${contribTeamName} — anggota tim DR yang sedang menceritakan tentang DIRINYA SENDIRI.
Sapaan: "lo"/"gw"/"lu". Gaya ngobrol: SANTAI, asik, penasaran — kayak temen kerja yang excited ngobrol.

TUGAS UTAMA: Gali profil lengkap ${contribTeamName} secara NATURAL melalui obrolan. Targetkan info berikut tapi JANGAN tanya semua sekaligus — ngalir aja:
1. Job desk / tanggung jawab utama
2. Gaya kerja (detail-oriented? big picture? deadline-driven?)
3. Gaya komunikasi (blak-blakan? diplomatik? to the point?)
4. Hal yang bikin sensitif / trigger (ga suka apa? kesel sama apa?)
5. Komitmen / value yang dipegang (apa yang penting buat dia?)
6. Catatan karakter umum (introvert/extrovert? kelebihan? kelemahan?)
7. Hubungan sama DR dan tim lain

CARA INTERVIEW:
- Mulai dari yang ringan (job desk, sehari-hari ngapain aja) lalu progressif ke yang lebih personal
- Tanya satu-dua hal, dengerin, respond, baru tanya lagi. BUKAN daftar pertanyaan
- Pakai pertanyaan follow-up natural: "oh gitu? terus gimana kalau...", "nah kalau misalnya..."
- Kalau ${contribTeamName} cerita sesuatu menarik, gali lebih dalam
- Sesekali validasi: "berarti lo tipe yang..." untuk konfirmasi
- TETAP dengerin kalau mereka mau cerita soal DR juga — itu bonus info
${existingPersona ? `\nDATA YANG SUDAH TERKUMPUL tentang ${contribTeamName}:\n${existingPersona}\n\nJANGAN tanya ulang hal yang sudah ada di atas. Fokus ke hal yang BELUM tergali, atau dalami yang sudah ada.` : ""}
JANGAN kaku atau formal. Ngobrol aja kayak biasa — tapi dengan tujuan mengenal ${contribTeamName} lebih dalam.`;
        } else {
          systemContent += `\n\n---\nMODE: CONTRIBUTOR. User ini kenal DR secara personal. Sapaan: "lo"/"gw"/"lu". 
Gaya ngobrol: SANTAI, asik, penasaran — kayak temen yang excited dengerin cerita. Mengalir natural, BUKAN wawancara atau interogasi.
PENTING: Kalau user cerita soal DR (kebiasaan, karakter, cerita, pendapat), dengerin dan responsif — tanya lebih dalam, gali detail, minta contoh. Tapi cara nanyanya kayak temen yang kepo, bukan interviewer.
JANGAN kaku atau formal. Ngobrol aja kayak biasa.

DI AWAL PERCAKAPAN (kalau belum ada history chat):
JANGAN langsung tanya nama. Itu kaku dan bikin orang merasa diinterogasi.
GILIRAN PERTAMA: Buka dengan sapaan hangat + icebreaker ringan yang bikin mereka cerita. Perkenalkan diri lo sebagai DARVIS, temen ngobrolnya DR. Lalu tanya sesuatu yang open-ended tentang mereka — misalnya lagi ngerjain apa, lagi sibuk apa, atau apa yang lagi di pikiran mereka. JANGAN tanya nama di giliran pertama ini.
GILIRAN KEDUA (setelah mereka jawab): Baru sisipkan tanya nama secara natural, misalnya "btw, panggil lo siapa ya biar enak ngobrolnya?" — sebagai bagian dari obrolan, bukan pertanyaan formal. Kalau mereka sudah sebut nama duluan di giliran pertama, gak usah tanya lagi.
Setelah dapat nama, cek apakah dia anggota tim DR. Kalau iya, lanjut gali profil dia pelan-pelan lewat obrolan natural (bukan daftar pertanyaan).`;
        }
      } else {
        systemContent += `\n\n---\nMODE: TWIN — Framework Distributor.
Kamu adalah DARVIS — sistem berpikir, BUKAN orang. JANGAN sebut DR/Bapak/Abah/YKW/Raha/identitas personal.
Sapaan: "lo"/"gw"/"lu" — BUKAN "Anda"/"saudara"/"kamu" yang kaku.
GAYA NGOBROL:
- Santai, mengalir, kayak ngobrol sama temen yang kebetulan pinter banget. BUKAN kayak ngobrol sama AI atau customer service.
- Boleh gaul, boleh slang, yang penting natural dan gak maksa.
- Jawaban HARUS punya substansi — bukan template generik. Singkat (2-5 kalimat default), tapi setiap kalimat bernilai.
- Berani kasih perspektif yang user belum pikirin. "Tapi coba liat dari sini..."
- JANGAN: jawaban datar, buka-bukaan formal, atau nada robotik. Harus terasa ada PEMIKIRAN di baliknya.
- Framework berpikir tetap tajam: multi-perspektif, counter-angle, risiko vs peluang — tapi cara nyampenya santai.`;
      }

      if (isMultiPersonaMode) {
        systemContent += `\n\n---\nAKTIF: MULTI-PERSPEKTIF (diminta user). Pecah analisis dari berbagai sudut pandang TAPI tetap dalam satu narasi mengalir. Tandai sudut pandang dengan bold label (**Dari sisi logika-risiko:**, **Dari sisi emosi-manusia:**, **Perspektif alternatif:**, **Dari pengalaman:**). JANGAN pakai format kotak-kotak "Broto: ... Rara: ..." — tulis sebagai satu esai yang mengalir dengan berbagai sudut.`;
      } else if (isDecisionFast) {
        systemContent += `\n\n---\nAKTIF: DECISION FAST. Format: 3 poin + 1 risiko + 1 blind spot + 1 aksi. Langsung struktur.`;
      } else {
        systemContent += `\n\n---\nAKTIF: SATU SUARA. Integrasikan 4 perspektif jadi satu narasi koheren. TANPA label persona.`;
      }

      const CONTEXT_MODE_FRAMINGS: Record<ContextMode, string> = {
        strategic: `\n\n---\nCONTEXT: STRATEGIC — formal-terstruktur, risiko eksplisit, stakeholder, framework pro/con.`,
        tactical: `\n\n---\nCONTEXT: TACTICAL — ringkas-actionable, langkah konkret, timeline/prioritas.`,
        reflection: `\n\n---\nCONTEXT: REFLECTION — lambat-dalam-empatik, dengarkan dulu, pertanyaan reflektif > jawaban tegas.`,
        crisis: `\n\n---\nCONTEXT: CRISIS — tenang-protektif, sekarang vs nanti, fakta vs asumsi, damage control.`,
        general: "",
      };

      if (contextMode !== "general") {
        systemContent += CONTEXT_MODE_FRAMINGS[contextMode];
      }

      const needsProfile = contextMode !== "general" || isStrategicEscalation || isDecisionFast || isMultiPersonaMode || /\b(filosofi|prinsip|cara\s+pikir|mindset|nilai|legacy|visi|misi|strategi\s+hidup|karakter\s+gw|gw\s+itu|gaya\s+gw)\b/i.test(message);
      if (drProfile && needsProfile) {
        if (isOwner) {
          systemContent += `\n\n---\nPROFIL MAS DR (referensi natural):\n${drProfile}`;
        } else if (!isContributor) {
          systemContent += `\n\n---\nFRAMEWORK SUMBER (pola pikir DARVIS — JANGAN sebut nama/identitas):\n${drProfile}`;
        } else {
          systemContent += `\n\n---\nPROFIL DR (konteks):\n${drProfile}`;
        }
      }

      if (isOwner) {
        const secretaryCtx = await buildSecretaryContext(message, isOwner);
        if (secretaryCtx) {
          systemContent += secretaryCtx;
          systemContent += `\n\n---\n⚠️ ATURAN WAJIB DATA SECRETARY:\n1. Semua data NODE_TEAM, NODE_MEETING, ACTION ITEMS di atas adalah FAKTA dari database. WAJIB gunakan sebagai acuan utama.\n2. DILARANG KERAS mengarang nama orang, tanggal, posisi, atau jumlah yang TIDAK ADA di data di atas.\n3. Kalau ditanya jumlah tim/anggota, HITUNG dari daftar NODE_TEAM. Kalau ditanya tanggal meeting, AMBIL dari NODE_MEETING.\n4. Kalau data yang ditanya TIDAK ADA di database, jawab jujur: "Gw belum punya data itu. Mau gw catet?"\n5. JANGAN PERNAH bilang "cek di dashboard" kalau lo sudah punya datanya di atas — langsung jawab dari data.`;
        }
      }

      let isBias = voiceMode ? false : detectBiasIntent(message);
      const isSolidGroup = voiceMode ? false : detectSolidGroupIntent(message);
      let isAiSG = voiceMode ? false : detectAiSGIntent(message);
      const isNM = voiceMode ? false : detectNMIntent(message);
      const isRiskGuard = voiceMode ? false : detectRiskGuardIntent(message);
      const isCompliance = voiceMode ? false : detectComplianceIntent(message);

      if (!voiceMode && tone.emotional && !isBias && !isNM && !isRiskGuard) {
        const explicitBiasKeywords = /\b(bias|keputusan\s+besar|dilema|galau\s+berat|bingung\s+banget|gak\s+tau\s+harus|harus\s+pilih|pilihan\s+sulit|pro\s+kontra|trade.?off|resiko\s+besar)\b/i;
        if (explicitBiasKeywords.test(message)) {
          isBias = true;
        }
      }




      if (isBias) {
        const biasPrompt = readPromptFile("DARVIS_NODE_BIAS.md");
        if (biasPrompt) {
          systemContent += `\n\n---\nNODE_BIAS (PRIORITAS):\n${biasPrompt}`;
          nodesUsed.push("NODE_BIAS");
        }
      }

      if (isRiskGuard) {
        const riskPrompt = readPromptFile("DARVIS_NODE_RISK_GUARD.md");
        if (riskPrompt) {
          systemContent += `\n\n---\nNODE_RISK_GUARD:\n${riskPrompt}`;
          nodesUsed.push("NODE_RISK_GUARD");
        }
      }

      if (isNM && !isRiskGuard) {
        const nmPrompt = readPromptFile("DARVIS_NODE_NM.md");
        if (nmPrompt) {
          systemContent += `\n\n---\nNODE_NM:\n${nmPrompt}`;
          nodesUsed.push("NODE_NM");
        }
      } else if (isNM && isRiskGuard) {
        const nmPrompt = readPromptFile("DARVIS_NODE_NM.md");
        if (nmPrompt) {
          systemContent += `\n\n---\nNODE_NM (subordinat RISK_GUARD):\n${nmPrompt}`;
          nodesUsed.push("NODE_NM");
        }
      }

      if (isAiSG) {
        const aisgPrompt = readPromptFile("DARVIS_NODE_AiSG.md");
        if (aisgPrompt) {
          systemContent += `\n\n---\nNODE_AiSG:\n${aisgPrompt}`;
          nodesUsed.push("NODE_AiSG");
        }
      }

      if (isCompliance) {
        const compliancePrompt = readPromptFile("DARVIS_NODE_COMPLIANCE.md");
        if (compliancePrompt) {
          systemContent += `\n\n---\nNODE_COMPLIANCE:\n${compliancePrompt}`;
          nodesUsed.push("NODE_COMPLIANCE");
        }
      }

      if (isSolidGroup) {
        const solidPrompt = readPromptFile("DARVIS_NODE_SolidGroup.md");
        if (solidPrompt) {
          systemContent += `\n\n---\nNODE_SOLIDGROUP:\n${solidPrompt}`;
          nodesUsed.push("NODE_SOLIDGROUP");
        }
      }

      const isResourceIntent = !voiceMode && /\b(buku|book|referensi|bacaan|sumber|resource|rekomendasi\s+baca|literature|riset|research|jurnal|paper|studi|framework.*referensi)\b/i.test(message);
      if (isResourceIntent) {
        const resourcePrompt = readPromptFile("DARVIS_NODE_RESOURCES.md");
        if (resourcePrompt) {
          systemContent += `\n\n---\nNODE_RESOURCES:\n${resourcePrompt}`;
          nodesUsed.push("NODE_RESOURCES");
        }
      }

      if (nodesUsed.length > 1) {
        const hasBiasNode = nodesUsed.includes("NODE_BIAS");
        const instruction = hasBiasNode
          ? `Prioritas BIAS → refleksi dulu, turunkan klaim, baru sentuh domain lain.`
          : `Multi-node aktif. Turunkan klaim, bahasa reflektif, bantu lihat dari berbagai sudut.`;
        systemContent += `\n\n---\nMULTI-NODE [${nodesUsed.join(", ")}]: ${instruction}`;
      }

      if (!voiceMode) {
        const toneSignals: string[] = [];
        if (tone.emotional) toneSignals.push("emosional/personal");
        if (tone.analytical) toneSignals.push("analitis/data-driven");
        if (tone.evaluative) toneSignals.push("evaluatif/menilai orang/tim");
        if (tone.urgent) toneSignals.push("urgensi tinggi");
        if (toneSignals.length > 0) {
          systemContent += `\n\n---\nTONE: ${toneSignals.join(", ")}.`;
          if (tone.emotional) systemContent += ` Emosional → acknowledgment dulu.`;
          if (tone.urgent) systemContent += ` Urgensi → cek apakah nyata.`;
          if (tone.evaluative) systemContent += ` Evaluatif → framework, bukan penilaian langsung.`;
        }

        if (isStrategicEscalation) {
          systemContent += `\n\n---\nESKALASI STRATEGIS: Tambah risiko sistemik + reputasi + jangka panjang (1-2 kalimat per risiko). Keputusan ini kemungkinan irreversible.`;
        }
      }

      if (!voiceMode) {
        const rawFeedbacks = await getPersonaFeedback(userId);
        const personaFeedbacks = applyMemoryGovernor(rawFeedbacks, 5);
        if (personaFeedbacks.length > 0) {
          const grouped: Record<string, { feedback: string; sentiment: string }[]> = {};
          for (const fb of personaFeedbacks) {
            if (!grouped[fb.target]) grouped[fb.target] = [];
            if (grouped[fb.target].length < 3) {
              grouped[fb.target].push({ feedback: fb.feedback, sentiment: fb.sentiment });
            }
          }
          let fbBlock = "\n\n---\nFEEDBACK PERSONA:\n";
          for (const [target, items] of Object.entries(grouped)) {
            const label = target === "dr" ? "DR" : target.charAt(0).toUpperCase() + target.slice(1);
            fbBlock += `[${label}]\n`;
            for (const item of items) {
              fbBlock += `- (${item.sentiment}) ${item.feedback}\n`;
            }
            fbBlock += "\n";
          }
          fbBlock += "Integrasikan natural, jangan sebut sumber.";
          systemContent += fbBlock;
        }

        const rawEnrichments = await getProfileEnrichments(userId);
        const contributorEnrichments = await getProfileEnrichments("contributor_shared");
        const ownerEnrichments = applyMemoryGovernor(rawEnrichments, 10);
        const contribEnrichments = applyMemoryGovernor(contributorEnrichments, 8);
        const profileEnrichments = [...ownerEnrichments, ...contribEnrichments];
        if (profileEnrichments.length > 0) {
          const grouped: Record<string, string[]> = {};
          for (const e of profileEnrichments) {
            if (!grouped[e.category]) grouped[e.category] = [];
            grouped[e.category].push(e.fact);
          }
          let enrichBlock: string;
          if (isOwner) {
            enrichBlock = "\n\n---\nINSIGHT TENTANG MAS DR (dari berbagai sumber — GUNAKAN AKTIF dalam percakapan, referensi natural, tunjukkan lo kenal dia):\n";
          } else if (isContributor) {
            enrichBlock = "\n\n---\nPROFIL DR (konteks):\n";
          } else {
            enrichBlock = "\n\n---\nPOLA PIKIR & FRAMEWORK TAMBAHAN (gunakan sebagai basis berpikir, JANGAN sebut sumber/nama):\n";
          }
          for (const [cat, facts] of Object.entries(grouped)) {
            const label = ENRICHMENT_CATEGORY_LABELS[cat] || cat;
            enrichBlock += `[${label}]\n`;
            for (const fact of facts) {
              enrichBlock += `- ${fact}\n`;
            }
            enrichBlock += "\n";
          }
          if (isOwner) {
            enrichBlock += "Pakai insight ini natural dalam percakapan. Tunjukkan lo kenal mas DR. Tetap counter jika perlu.";
          } else {
            enrichBlock += "Konteks, bukan kebenaran — tetap counter jika perlu.";
          }
          systemContent += enrichBlock;
        }

        const rawPrefs = await getLearnedPreferences(userId);
        const learnedPrefs = applyMemoryGovernor(rawPrefs, 5);
        if (learnedPrefs.length > 0) {
          const grouped: Record<string, string[]> = {};
          for (const pref of learnedPrefs) {
            if (!grouped[pref.category]) grouped[pref.category] = [];
            grouped[pref.category].push(pref.insight);
          }
          let prefBlock = "\n\n---\nPREFERENSI USER:\n";
          for (const [cat, insights] of Object.entries(grouped)) {
            prefBlock += `[${cat}]\n`;
            for (const ins of insights) {
              prefBlock += `- ${ins}\n`;
            }
            prefBlock += "\n";
          }
          prefBlock += "Konteks personalisasi, tetap counter jika perlu.";
          systemContent += prefBlock;
        }
      }

      if (voiceMode) {
        systemContent += `\n\n---\n🎙️ VOICE CONVERSATION MODE AKTIF — WAJIB DIPATUHI:
- User sedang NGOBROL LANGSUNG pakai suara. Responsmu akan dibacakan oleh TTS.
- JAWAB MAKSIMAL 2-3 KALIMAT PENDEK. Ini percakapan lisan, BUKAN tulisan.
- LANGSUNG ke inti. TANPA pembukaan, TANPA daftar panjang, TANPA bullet points.
- Gaya: ngobrol santai, natural, kayak obrolan telepon. Pendek, padat, mengalir.
- JANGAN pakai markdown (bold, heading, list, code block). Plain text aja.
- Kalau topik kompleks, jawab singkat dulu, tawarin: "Mau gw jelasin lebih detail?"
- INGAT: setiap kata = waktu tunggu user. Lebih singkat = lebih baik.`;
      }

      const msgWordCount = message.trim().split(/\s+/).length;
      const detailKeywords = /\b(detail|rinci|breakdown|jelaskan\s+lengkap|jelasin\s+dong|jelasin\s+detail|analisis\s+mendalam|analisis\s+lengkap|uraikan|elaborate|pecah(kan)?|deep\s*dive|step\s*by\s*step|lengkap(in)?|bedah)\b/i;
      const wantsDetail = detailKeywords.test(message);

      if (!wantsDetail) {
        systemContent += `\n\n---\n⚡ REMINDER FINAL (PATUHI!):\nJawab 1-3 kalimat. Tek-tok. Ngobrol, bukan esai. TITIK. Lebih singkat = lebih baik. JANGAN bikin paragraf panjang atau bullet list kecuali user minta "detail".`;
      }

      const apiMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];
      apiMessages.push({ role: "system", content: systemContent });

      const systemTokenEstimate = Math.ceil(systemContent.length / 3.5);
      const isHeavyContext = nodesUsed.length >= 2 || wantsDetail || contextMode !== "general" || isStrategicEscalation;
      const hasHeavyNode = nodesUsed.some(n => ["NODE_BIAS", "NODE_RISK_GUARD", "NODE_NM", "NODE_COMPLIANCE"].includes(n));
      const needsGPT5 = wantsDetail || isHeavyContext || hasHeavyNode || isMultiPersonaMode || isDecisionFast || hasImages || (isContributor && !!req.session.contributorTeamMemberId) || contextMode !== "general" || msgWordCount > 50 || /\b(analisis|strategi|keputusan|evaluasi|review|rencana|plan|gimana\s+menurut|gimana\s+cara|apa\s+pendapat|bantu\s+gw)\b/i.test(message);
      const selectedModel = needsGPT5 ? "gpt-5" : "gpt-4o";
      const reasoningEffort = needsGPT5 ? (wantsDetail ? "medium" : "low") : undefined;
      const maxTokens = wantsDetail ? 2048 : (voiceMode ? 512 : (needsGPT5 ? 1024 : 768));
      console.log(`[PROMPT] model: ${selectedModel}, size: ~${systemTokenEstimate}tok, nodes: [${nodesUsed.join(", ")}], voice: ${voiceMode}, msgWords: ${msgWordCount}, reasoning: ${reasoningEffort || "n/a"}, maxTok: ${maxTokens}`);

      const summary = activeRoomId ? await getRoomSummary(activeRoomId) : await getSummary(userId);
      if (summary) {
        apiMessages.push({
          role: "system",
          content: `RINGKASAN PERCAKAPAN SEBELUMNYA:\n${summary}`,
        });
      }

      const contextBudget = isHeavyContext ? 10 : (voiceMode ? 4 : 6);
      const recentMessages = activeRoomId ? await getLastMessagesForRoom(activeRoomId, contextBudget) : await getLastMessages(userId, contextBudget);
      for (const msg of recentMessages) {
        apiMessages.push({
          role: msg.role === "user" ? "user" : "assistant",
          content: msg.content,
        });
      }

      if (hasImages) {
        const contentParts: OpenAI.Chat.Completions.ChatCompletionContentPart[] = [
          { type: "text", text: message },
        ];
        for (const img of images) {
          const base64Data = img.startsWith("data:") ? img : `data:image/png;base64,${img}`;
          contentParts.push({
            type: "image_url",
            image_url: { url: base64Data, detail: "auto" },
          });
        }
        apiMessages.push({ role: "user", content: contentParts });
      } else {
        apiMessages.push({ role: "user", content: message });
      }

      const nodeUsed = nodesUsed.length > 0 ? nodesUsed.join(", ") : null;

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.setHeader("X-Accel-Buffering", "no");
      res.flushHeaders();

      const abortController = new AbortController();
      const timeout = setTimeout(() => abortController.abort(), 90000);

      const heartbeatInterval = setInterval(() => {
        try {
          res.write(`data: ${JSON.stringify({ type: "heartbeat" })}\n\n`);
          if (typeof (res as any).flush === "function") {
            (res as any).flush();
          }
        } catch { /* connection closed */ }
      }, 15000);

      const serverCleanup = () => {
        clearTimeout(timeout);
        clearInterval(heartbeatInterval);
        abortController.abort();
      };

      res.on("close", serverCleanup);

      try {
        const chatParams: any = {
          model: selectedModel,
          messages: apiMessages,
          max_completion_tokens: maxTokens,
          stream: true,
        };
        if (reasoningEffort) {
          chatParams.reasoning_effort = reasoningEffort;
        }
        const stream = await (openai.chat.completions.create as any)(chatParams, { signal: abortController.signal });

        let fullReply = "";
        let lastFinishReason: string | null = null;
        for await (const chunk of stream) {
          const choice = chunk.choices[0];
          const delta = choice?.delta?.content;
          if (choice?.finish_reason) {
            lastFinishReason = choice.finish_reason;
          }
          if (delta) {
            fullReply += delta;
            res.write(`data: ${JSON.stringify({ type: "chunk", content: delta })}\n\n`);
            if (typeof (res as any).flush === "function") {
              (res as any).flush();
            }
          }
        }
        clearTimeout(timeout);
        clearInterval(heartbeatInterval);
        res.removeListener("close", serverCleanup);

        const presentationMode = isOwner ? "mirror" : isContributor ? "contributor" : "twin";
        let reply: string;
        if (!fullReply.trim()) {
          console.error(`[EMPTY_RESPONSE] API returned empty for message: "${message.substring(0, 100)}", prompt size: ${systemContent.length} chars, finishReason: ${lastFinishReason}`);
          reply = "Maaf, gw butuh waktu untuk memproses pertanyaan ini. Coba ulangi atau rephrase ya.";
          if (!isOwner) {
            reply = mergePersonasToUnifiedVoice(reply);
          }
          if (roomActionPromise) {
            try { roomActionResult = await roomActionPromise; } catch (_e) { roomActionResult = null; }
          }

          if (roomActionResult && !activeRoomId) {
            if (roomActionResult.action === "create_new") {
              const newRoomId = await createChatRoom(userId, roomActionResult.roomTitle || "Obrolan Baru");
              activeRoomId = newRoomId;
              roomActionResult.roomId = newRoomId;
              console.log(`Auto-created room #${newRoomId}: "${roomActionResult.roomTitle}"`);
            } else if (roomActionResult.action === "move_to_existing" && roomActionResult.roomId) {
              activeRoomId = roomActionResult.roomId;
              console.log(`Auto-moving to room #${roomActionResult.roomId}: "${roomActionResult.roomTitle}"`);
            }
          }

          const donePayload: any = { type: "done", nodeUsed, contextMode, presentationMode, fullReply: reply };
          if (roomActionResult && isOwner) {
            donePayload.roomAction = roomActionResult;
          }
          res.write(`data: ${JSON.stringify(donePayload)}\n\n`);
        } else {
          reply = enforceFormat(fullReply, isMultiPersonaMode);
          if (!isOwner) {
            reply = mergePersonasToUnifiedVoice(reply);
          }

          if (roomActionPromise) {
            try { roomActionResult = await roomActionPromise; } catch (_e) { roomActionResult = null; }
          }

          if (roomActionResult && !activeRoomId) {
            if (roomActionResult.action === "create_new") {
              const newRoomId = await createChatRoom(userId, roomActionResult.roomTitle || "Obrolan Baru");
              activeRoomId = newRoomId;
              roomActionResult.roomId = newRoomId;
              console.log(`Auto-created room #${newRoomId}: "${roomActionResult.roomTitle}"`);
            } else if (roomActionResult.action === "move_to_existing" && roomActionResult.roomId) {
              activeRoomId = roomActionResult.roomId;
              console.log(`Auto-moving to room #${roomActionResult.roomId}: "${roomActionResult.roomTitle}"`);
            }
          }

          const donePayload: any = { type: "done", nodeUsed, contextMode, presentationMode, fullReply: (!isOwner || isContributor) ? reply : undefined };
          if (roomActionResult && isOwner) {
            donePayload.roomAction = roomActionResult;
          }
          res.write(`data: ${JSON.stringify(donePayload)}\n\n`);
        }
        res.end();

        if (activeRoomId) {
          await saveMessageToRoom(activeRoomId, userId, "user", message);
          await saveMessageToRoom(activeRoomId, userId, "assistant", reply);
        } else {
          await saveMessage(userId, "user", message);
          await saveMessage(userId, "assistant", reply);
        }

        try {
          const toneSignalsForTag: string[] = [];
          if (tone.emotional) toneSignalsForTag.push("emosional");
          if (tone.analytical) toneSignalsForTag.push("analitis");
          if (tone.evaluative) toneSignalsForTag.push("evaluatif");
          if (tone.urgent) toneSignalsForTag.push("urgensi");

          await saveConversationTag(userId, {
            context_mode: contextMode,
            decision_type: decisionType,
            emotional_tone: toneSignalsForTag.length > 0 ? toneSignalsForTag.join(",") : null,
            nodes_active: nodesUsed.length > 0 ? nodesUsed.join(",") : null,
            strategic_escalation: isStrategicEscalation,
            fast_decision: isDecisionFast,
            multi_persona: isMultiPersonaMode,
            user_message_preview: message.substring(0, 200),
          });
        } catch (tagErr: any) {
          console.error("Silent tagging error:", tagErr?.message || tagErr);
        }

        if (detectPersonaMention(message)) {
          extractPersonaFeedback(userId, message, reply).catch((err) => {
            console.error("Passive listening error:", err?.message || err);
          });
        }

        if (isContributor) {
          extractProfileEnrichment("contributor_shared", message, true).catch((err) => {
            console.error("Contributor enrichment error:", err?.message || err);
          });
          const contribTeamId = req.session.contributorTeamMemberId;
          const contribTeamName = req.session.contributorTeamMemberName;
          if (contribTeamId && contribTeamName) {
            extractContributorSelfProfile(contribTeamName, message, reply).catch((err) => {
              console.error("Contributor self-profile extraction error:", err?.message || err);
            });
          }
        } else if (detectDRIdentity(message)) {
          extractProfileEnrichment(userId, message, false).catch((err) => {
            console.error("Profile enrichment error:", err?.message || err);
          });
        }

        const msgCount = activeRoomId ? await getMessageCountForRoom(activeRoomId) : await getMessageCount(userId);
        console.log(`Post-chat: isOwner=${isOwner}, isContributor=${isContributor}, msgLen=${message.length}, replyLen=${reply.length}`);
        if (isOwner) {
          console.log("Post-chat: calling extractSecretaryData NOW");
          const recentMsgs = activeRoomId
            ? await getLastMessagesForRoom(activeRoomId, 6)
            : await getLastMessages(userId, 6);
          const recentHistory = recentMsgs.map((m: any) => ({ role: m.role as string, content: m.content as string }));
          extractSecretaryData(message, reply, recentHistory).then(() => {
            console.log("Post-chat: extractSecretaryData completed successfully");
          }).catch((err) => {
            console.error("Secretary extraction error:", err?.message || err);
            if (err?.stack) console.error("Secretary extraction call stack:", err.stack.split("\n").slice(0, 5).join("\n"));
          });
        } else {
          console.log("Post-chat: skipping extraction (not owner)");
        }

        if (msgCount > 0 && msgCount % 20 === 0) {
          if (activeRoomId) {
            generateRoomSummary(activeRoomId, userId).catch((err) => {
              console.error("Auto-summary (room) error:", err?.message || err);
            });
          } else {
            generateSummary(userId).catch((err) => {
              console.error("Auto-summary error:", err?.message || err);
            });
          }
        }

        if (msgCount > 0 && msgCount % 10 === 0) {
          extractPreferences(userId).catch((err) => {
            console.error("Auto-learn error:", err?.message || err);
          });
        }
      } catch (streamErr: any) {
        clearTimeout(timeout);
        clearInterval(heartbeatInterval);
        res.removeListener("close", serverCleanup);
        const isTimeout = streamErr?.name === "AbortError";
        const statusCode = streamErr?.status || streamErr?.statusCode || streamErr?.code;
        const errMessage = streamErr?.message || String(streamErr);
        const isQuota = statusCode === 429 || errMessage.includes("429") || errMessage.includes("quota") || errMessage.includes("rate limit");
        const isAuthError = statusCode === 401 || statusCode === 403;

        let errorMsg: string;
        let retryable = true;
        if (isQuota) {
          errorMsg = "Kuota API sedang penuh. Coba lagi dalam beberapa menit ya.";
          retryable = false;
        } else if (isAuthError) {
          errorMsg = "Ada masalah autentikasi API. Hubungi admin.";
          retryable = false;
        } else if (isTimeout) {
          errorMsg = "Respons terlalu lama. Coba kirim ulang ya.";
        } else {
          errorMsg = "Koneksi terputus. Coba lagi ya.";
        }

        console.error("Stream error:", isQuota ? "QUOTA_EXCEEDED" : isTimeout ? "TIMEOUT" : errMessage, "| status:", statusCode, "| full:", JSON.stringify({ message: errMessage, status: statusCode, type: streamErr?.type, code: streamErr?.code }));
        if (!res.headersSent) {
          return res.status(isQuota ? 429 : 500).json({ message: errorMsg });
        }
        res.write(`data: ${JSON.stringify({ type: "error", message: errorMsg, retryable })}\n\n`);
        res.end();
      }
    } catch (err: any) {
      console.error("Chat API error:", err?.message || err);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  return httpServer;
}

async function extractPreferences(userId: string) {
  const allMessages = await getAllMessages(userId);
  if (allMessages.length < 6) return;

  const last20 = allMessages.slice(-20);
  const conversationText = last20
    .map((m) => `${m.role === "user" ? "User" : "DARVIS"}: ${m.content}`)
    .join("\n\n");

  const existingPrefs = await getLearnedPreferences(userId);
  const existingContext = existingPrefs.length > 0
    ? `\nPreferensi yang sudah diketahui sebelumnya:\n${existingPrefs.map(p => `- [${p.category}] ${p.insight}`).join("\n")}\n\nPerbarui atau tambahkan insight baru berdasarkan percakapan terbaru. Jangan duplikasi yang sudah ada kecuali ada perubahan.`
    : "";

  const prompt = `Kamu adalah DARVIS, asisten berpikir untuk mas DR. Analisis percakapan berikut dan ekstrak insight tentang profil, preferensi, dan pola berpikir mas DR.
${existingContext}
Percakapan terbaru:
${conversationText}

Ekstrak insight dalam format JSON array. Setiap insight harus memiliki:
- category: salah satu dari "gaya_berpikir", "preferensi_komunikasi", "konteks_bisnis", "pola_keputusan", "area_fokus", "koreksi_penting", "gaya_kepemimpinan", "pola_stres", "area_blind_spot", "prinsip_hidup", "filosofi_bisnis", "gaya_bahasa"
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
- "gaya_kepemimpinan" = cara user memimpin tim (tegas, coaching, delegatif, micromanage, dll), pola interaksi dengan bawahan, pendekatan ke masalah SDM
- "pola_stres" = tanda-tanda stres atau kelelahan yang terlihat, trigger stres, cara coping, kapan energi turun
- "area_blind_spot" = hal-hal yang user cenderung abaikan, asumsi yang tidak diperiksa, pola berulang yang belum disadari, keputusan yang terlalu cepat tanpa refleksi
- "prinsip_hidup" = nilai-nilai dan prinsip yang dipegang teguh, filosofi personal, cara pandang terhadap hidup dan pekerjaan
- "filosofi_bisnis" = cara pandang terhadap bisnis, strategi, dan organisasi, pendekatan ke masalah bisnis
- "gaya_bahasa" = kosakata khas, ungkapan favorit, campuran bahasa, level formalitas yang disukai
- Maksimal 10 insight per ekstraksi
- Prioritaskan "area_blind_spot" dan "pola_stres" jika terdeteksi — ini paling berharga untuk proactive reflection
- Jika tidak ada insight baru yang jelas, kembalikan array kosong []

Respond ONLY with valid JSON array, no other text.`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      max_completion_tokens: 2048,
    });

    const raw = completion.choices[0]?.message?.content?.trim();
    if (!raw) return;

    const jsonMatch = raw.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return;

    const parsed = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(parsed) || parsed.length === 0) return;

    const validCategories = ["gaya_berpikir", "preferensi_komunikasi", "konteks_bisnis", "pola_keputusan", "area_fokus", "koreksi_penting", "gaya_kepemimpinan", "pola_stres", "area_blind_spot", "prinsip_hidup", "filosofi_bisnis", "gaya_bahasa"];
    const validPrefs = parsed
      .filter((p: any) =>
        p.category && validCategories.includes(p.category) &&
        p.insight && typeof p.insight === "string" &&
        typeof p.confidence === "number" && p.confidence >= 0.5 && p.confidence <= 1.0
      )
      .slice(0, 10)
      .map((p: any) => ({
        category: p.category as string,
        insight: p.insight as string,
        confidence: p.confidence as number,
        source_summary: (p.source_summary as string) || null,
      }));

    if (validPrefs.length > 0) {
      await bulkUpsertPreferences(userId, validPrefs);
      console.log(`Auto-learn: extracted ${validPrefs.length} preferences for ${userId}`);
    }
  } catch (err: any) {
    console.error("Preference extraction failed:", err?.message || err);
  }
}

async function generateSummary(userId: string) {
  const allMessages = await getAllMessages(userId);
  if (allMessages.length < 10) return;

  const last30 = allMessages.slice(-30);
  const conversationText = last30
    .map((m) => `${m.role === "user" ? "User" : "DARVIS"}: ${m.content}`)
    .join("\n\n");

  const existingSummary = await getSummary(userId);

  const prompt = existingSummary
    ? `Kamu adalah DARVIS, asisten berpikir untuk mas DR.\n\nRingkasan sebelumnya:\n${existingSummary}\n\nPercakapan terbaru:\n${conversationText}\n\nBuatkan ringkasan singkat (max 300 kata) yang menggabungkan ringkasan sebelumnya dan percakapan terbaru. Fokus pada: topik yang dibahas, keputusan penting, konteks emosional, dan insight yang muncul. Tulis dalam bahasa Indonesia.`
    : `Kamu adalah DARVIS, asisten berpikir untuk mas DR.\n\nPercakapan:\n${conversationText}\n\nBuatkan ringkasan singkat (max 300 kata) dari percakapan ini. Fokus pada: topik yang dibahas, keputusan penting, konteks emosional, dan insight yang muncul. Tulis dalam bahasa Indonesia.`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    max_completion_tokens: 2048,
  });

  const summaryText = completion.choices[0]?.message?.content?.trim();
  if (summaryText) {
    await upsertSummary(userId, summaryText);
    console.log(`Auto-summary generated for ${userId} (${allMessages.length} messages)`);
  }
}

interface RoomAction {
  action: "stay_lobby" | "move_to_existing" | "create_new";
  roomId?: number;
  roomTitle?: string;
  reason?: string;
}

async function detectRoomAction(userMessage: string, userId: string): Promise<RoomAction> {
  const roomSummaries = await getAllRoomSummaries(userId);
  if (roomSummaries.length === 0) {
    const isSubstantive = userMessage.trim().split(/\s+/).length >= 3;
    if (!isSubstantive) return { action: "stay_lobby", reason: "Pesan terlalu singkat" };
    const autoTitle = userMessage.trim().substring(0, 50).replace(/\s+/g, " ");
    return { action: "create_new", roomTitle: autoTitle || "Obrolan Baru", reason: "Belum ada room, topik baru" };
  }

  const roomList = roomSummaries.map(r => {
    const summarySnippet = r.summary ? r.summary.substring(0, 200) : "belum ada summary";
    return `- Room #${r.roomId}: "${r.title}" | ${summarySnippet}`;
  }).join("\n");

  const prompt = `Kamu adalah DARVIS room manager. Analisis pesan user dan tentukan apakah pesan ini:
1. Berhubungan dengan room yang sudah ada (MOVE) 
2. Topik baru yang substantif dan perlu room baru (CREATE)
3. Obrolan ringan/singkat yang gak perlu disimpan di room (LOBBY)

ROOM YANG SUDAH ADA:
${roomList}

PESAN USER:
"${userMessage.substring(0, 500)}"

ATURAN:
- Kalau pesan jelas nyambung dengan topik room yang ada → MOVE
- Kalau pesan substantif (diskusi, strategi, masalah, dll) tapi beda topik → CREATE
- Kalau pesan singkat, sapaan, basa-basi, tanya ringan → LOBBY
- Lebih baik MOVE ke room existing daripada CREATE baru kalau topiknya mirip

Jawab HANYA dalam format JSON (tanpa markdown):
{"action": "move" | "create" | "lobby", "roomId": <number kalau move, null kalau bukan>, "title": "<judul room baru kalau create, null kalau bukan>", "reason": "<alasan singkat>"}`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      max_completion_tokens: 256,
    });

    const raw = completion.choices[0]?.message?.content?.trim() || "";
    const cleaned = raw.replace(/```json\s*/g, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(cleaned);

    if (parsed.action === "move" && parsed.roomId) {
      const validRoom = roomSummaries.find(r => r.roomId === parsed.roomId);
      if (validRoom) {
        return { action: "move_to_existing", roomId: parsed.roomId, roomTitle: validRoom.title, reason: parsed.reason };
      }
    }
    if (parsed.action === "create") {
      return { action: "create_new", roomTitle: parsed.title || "Obrolan Baru", reason: parsed.reason };
    }
    return { action: "stay_lobby", reason: parsed.reason || "Obrolan ringan" };
  } catch (err: any) {
    console.error("Room detection error:", err?.message || err);
    return { action: "stay_lobby", reason: "Detection error, defaulting to lobby" };
  }
}

async function generateRoomSummary(roomId: number, userId: string) {
  const allMessages = await getAllMessagesForRoom(roomId);
  if (allMessages.length < 10) return;

  const last30 = allMessages.slice(-30);
  const conversationText = last30
    .map((m) => `${m.role === "user" ? "User" : "DARVIS"}: ${m.content}`)
    .join("\n\n");

  const existingSummary = await getRoomSummary(roomId);

  const prompt = existingSummary
    ? `Kamu adalah DARVIS, asisten berpikir untuk mas DR.\n\nRingkasan sebelumnya:\n${existingSummary}\n\nPercakapan terbaru:\n${conversationText}\n\nBuatkan ringkasan singkat (max 300 kata) yang menggabungkan ringkasan sebelumnya dan percakapan terbaru. Fokus pada: topik yang dibahas, keputusan penting, konteks emosional, dan insight yang muncul. Tulis dalam bahasa Indonesia.`
    : `Kamu adalah DARVIS, asisten berpikir untuk mas DR.\n\nPercakapan:\n${conversationText}\n\nBuatkan ringkasan singkat (max 300 kata) dari percakapan ini. Fokus pada: topik yang dibahas, keputusan penting, konteks emosional, dan insight yang muncul. Tulis dalam bahasa Indonesia.`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    max_completion_tokens: 2048,
  });

  const summaryText = completion.choices[0]?.message?.content?.trim();
  if (summaryText) {
    await setRoomSummary(roomId, summaryText);
    console.log(`Auto-summary generated for room ${roomId} (${allMessages.length} messages)`);
  }
}

async function extractContributorSelfProfile(memberName: string, userMessage: string, assistantReply: string) {
  const combinedText = `${memberName}: ${userMessage}\n\nDARVIS: ${assistantReply}`;
  const existingMember = await getTeamMemberByNameOrAlias(memberName);
  if (!existingMember) return;

  const existingData = [
    existingMember.position ? `Posisi: ${existingMember.position}` : null,
    existingMember.work_style ? `Gaya kerja: ${existingMember.work_style}` : null,
    existingMember.communication_style ? `Gaya komunikasi: ${existingMember.communication_style}` : null,
    existingMember.triggers ? `Trigger: ${existingMember.triggers}` : null,
    existingMember.commitments ? `Komitmen: ${existingMember.commitments}` : null,
    existingMember.personality_notes ? `Catatan karakter: ${existingMember.personality_notes}` : null,
    existingMember.responsibilities ? `Tanggung jawab: ${existingMember.responsibilities}` : null,
  ].filter(Boolean).join("\n");

  const prompt = `Kamu adalah sistem extraction DARVIS. Analisis percakapan berikut antara ${memberName} (anggota tim DR) dan DARVIS. ${memberName} sedang menceritakan tentang DIRINYA SENDIRI.

${existingData ? `DATA YANG SUDAH ADA tentang ${memberName}:\n${existingData}\n` : ""}
PERCAKAPAN:
${combinedText}

Ekstrak informasi BARU tentang ${memberName} yang belum ada di data existing. Format JSON:
{
  "position": "posisi/jabatan/job desk (string atau null kalau tidak disebut)",
  "responsibilities": "tanggung jawab utama (string atau null)",
  "work_style": "gaya kerja — detail baru saja, jangan duplikat existing (string atau null)",
  "communication_style": "gaya komunikasi — detail baru saja (string atau null)",
  "triggers": "hal yang bikin sensitif/kesal — detail baru saja (string atau null)",
  "commitments": "komitmen/value/prinsip kerja — detail baru saja (string atau null)",
  "personality_notes": "catatan karakter umum — detail baru saja (string atau null)",
  "strengths": "kelebihan yang disebut (string atau null)",
  "weaknesses": "kelemahan yang disebut (string atau null)"
}

RULES:
- HANYA ekstrak info yang JELAS disebutkan ${memberName} tentang dirinya sendiri
- JANGAN duplikat info yang sudah ada di data existing
- Kalau tidak ada info baru yang relevan, kembalikan semua field sebagai null
- Respond ONLY with valid JSON`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      max_completion_tokens: 1024,
    });

    const raw = completion.choices[0]?.message?.content?.trim();
    if (!raw) return;
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return;
    const parsed = JSON.parse(jsonMatch[0]);

    const appendIfNew = (existing: string | null, newVal: string | null): string | null => {
      if (!newVal) return existing;
      if (!existing) return newVal;
      if (existing.toLowerCase().includes(newVal.toLowerCase())) return existing;
      return `${existing}; ${newVal}`;
    };

    const hasUpdate = parsed.position || parsed.responsibilities || parsed.work_style || parsed.communication_style || parsed.triggers || parsed.commitments || parsed.personality_notes || parsed.strengths || parsed.weaknesses;
    if (!hasUpdate) return;

    await upsertTeamMember({
      name: existingMember.name,
      position: parsed.position || existingMember.position || null,
      strengths: appendIfNew(existingMember.strengths, parsed.strengths),
      weaknesses: appendIfNew(existingMember.weaknesses, parsed.weaknesses),
      responsibilities: parsed.responsibilities || existingMember.responsibilities || null,
      notes: existingMember.notes || null,
      aliases: existingMember.aliases || null,
      category: existingMember.category || "team",
      work_style: appendIfNew(existingMember.work_style, parsed.work_style),
      communication_style: appendIfNew(existingMember.communication_style, parsed.communication_style),
      triggers: appendIfNew(existingMember.triggers, parsed.triggers),
      commitments: appendIfNew(existingMember.commitments, parsed.commitments),
      personality_notes: appendIfNew(existingMember.personality_notes, parsed.personality_notes),
    });
    console.log(`Contributor self-profile: updated persona for "${existingMember.name}" [self-reported]`);
  } catch (err: any) {
    console.error("extractContributorSelfProfile error:", err?.message || err);
  }
}

async function extractSecretaryData(userMessage: string, assistantReply: string, recentHistory: Array<{role: string, content: string}> = []) {
  console.log(`extractSecretaryData: ENTERED — userMsg=${userMessage.substring(0, 80)}...`);
  let combinedText = "";
  if (recentHistory.length > 0) {
    const filtered = recentHistory.slice(-6).filter(m => m.content !== userMessage && m.content !== assistantReply);
    if (filtered.length > 0) {
      const historyLines = filtered.map(m => `${m.role === "user" ? "User" : "DARVIS"}: ${m.content}`);
      combinedText = historyLines.join("\n\n") + "\n\n";
    }
  }
  combinedText += `User: ${userMessage}\n\nDARVIS: ${assistantReply}`;

  const wibDateStr = getWIBDateString();
  const wibTimeStr = getWIBTimeString();
  const wibDayName = getWIBDayName();

  const teamMembers = await getTeamMembers();
  const existingProjects = await getProjects();
  const pendingActions = await getPendingActionItems();

  const existingContext = [
    teamMembers.length > 0 ? `Orang yang sudah tercatat: ${teamMembers.map(m => `${m.name}${m.aliases ? ` (alias: ${m.aliases})` : ""} [${m.category}]${m.position ? ` — ${m.position}` : ""}`).join(", ")}` : "",
    existingProjects.length > 0 ? `Project yang sudah tercatat: ${existingProjects.map(p => `${p.name} (${p.status})`).join(", ")}` : "",
    pendingActions.length > 0 ? `Action items pending: ${pendingActions.slice(0, 10).map(a => `${a.title} → ${a.assignee || "unassigned"}`).join(", ")}` : "",
  ].filter(Boolean).join("\n");

  const prompt = `Kamu adalah sistem extraction DARVIS. Analisis percakapan berikut dan ekstrak data terkait TIM, MEETING, ACTION ITEMS, dan PROJECT.

${existingContext ? `KONTEKS YANG SUDAH ADA:\n${existingContext}\n` : ""}
PERCAKAPAN:
${combinedText}

Ekstrak dalam format JSON dengan struktur:
{
  "team_members": [
    { "name": "string", "position": "string|null", "strengths": "string|null", "weaknesses": "string|null", "responsibilities": "string|null", "notes": "string|null", "aliases": "comma-separated aliases|null", "category": "team|direksi|family|external|management", "work_style": "string|null", "communication_style": "string|null", "triggers": "string|null", "commitments": "string|null", "personality_notes": "string|null" }
  ],
  "meetings": [
    { "title": "string", "date_time": "YYYY-MM-DD HH:MM|null", "participants": "comma-separated names|null", "agenda": "string|null" }
  ],
  "action_items": [
    { "title": "string", "assignee": "string|null", "deadline": "YYYY-MM-DD|null", "priority": "low|medium|high|urgent", "source": "conversation", "notes": "string|null" }
  ],
  "projects": [
    { "name": "string", "description": "string|null", "pic": "string|null", "status": "planning|active|on_hold|completed|cancelled", "milestones": "string|null", "deadline": "YYYY-MM-DD|null", "progress": 0, "notes": "string|null" }
  ],
  "follow_ups": [
    { "text": "string", "deadline_hint": "string|null" }
  ]
}

RULES:
- Hanya ekstrak informasi yang JELAS disebutkan dalam percakapan, jangan berasumsi
- Untuk nama tim member, gunakan nama yang disebutkan (contoh: "Andi", "Sari", bukan "dia" atau "orang itu")
- Jika ada nama yang sudah tercatat di konteks, UPDATE info-nya alih-alih buat entri baru
- Untuk meeting, WAJIB parsing tanggal/waktu dari bahasa natural ke format YYYY-MM-DD HH:MM
- Untuk action items: tangkap instruksi, delegasi, tugas, follow-up yang disebut. Parsing deadline dari bahasa natural.
- Untuk projects: tangkap project baru atau update status project existing. Parsing deadline dari bahasa natural.
- follow_ups: tangkap hal-hal yang user bilang "nanti gw..." atau "besok mau..." sebagai reminder. Parsing deadline_hint ke tanggal konkret.
- PENTING: Jika user menyebut nama orang dan memberikan info tentang orang tersebut (siapa dia, posisi, relasi, karakter, gaya kerja, dll), SELALU ekstrak ke team_members. Cek daftar existing — jika nama/alias cocok, UPDATE. Jika baru, buat entri baru.
- PERSONA FIELDS (tangkap kalau ada info relevan):
  - work_style: cara kerja orang ini (misal: "detail-oriented, perfeksionis", "big picture thinker", "cepat tapi sering miss detail")
  - communication_style: cara komunikasi (misal: "to the point", "suka ngomong panjang", "pasif-agresif", "blak-blakan")
  - triggers: hal yang bikin dia sensitif/emosi/tersinggung (misal: "ga suka dikritik di depan umum", "kesel kalau deadline mepet")
  - commitments: komitmen/janji/tanggung jawab personal (misal: "committed ke deadline", "sering telat submit", "reliable kalau sudah janji")
  - personality_notes: catatan karakter umum (misal: "introvert tapi kuat kalau udah ngomong", "loyal banget ke tim")
- Kategori orang: "team" (bawahan/tim BD), "direksi" (direktur PT), "management" (atasan/peers), "family" (keluarga), "external" (orang luar)
- Jika tidak ada data untuk suatu kategori, kembalikan array kosong
- Tanggal hari ini (WIB): ${wibDateStr} (${wibDayName})
- Waktu sekarang (WIB): ${wibTimeStr}
- Timezone: WIB (UTC+7) — SEMUA tanggal/waktu harus dalam WIB
- Maksimal 5 item per kategori

RULE KRITIS — KEYWORD TRIGGER (WAJIB SIMPAN DATA):
Kata-kata berikut adalah TRIGGER WAJIB untuk menyimpan data. Jika user menyebut salah satu dari kata ini, WAJIB ekstrak ke meetings atau action_items:
KEYWORD LIST: catet, catat, ingetin, ingatkan, meeting, jadwal, agenda, noted, note, tulis, tuliskan, remind, schedule, booking, book, reservasi, daftarkan, masukin, tambahin, simpen, save, jangan lupa, tolong ingetin, mau ke, ada acara, appointment

ATURAN PENYIMPANAN:
1. Ada TANGGAL dan/atau JAM → WAJIB masuk "meetings"
   - Title = deskripsi aktivitas (misal: "Cek fisik", "Meeting client", "Ke oma")
   - date_time = YYYY-MM-DD HH:MM (WIB)
   - Jika ada tanggal TAPI TIDAK ada jam → default jam 09:00
   - Jika ada jam TAPI TIDAK ada tanggal → asumsikan HARI INI (${wibDateStr})
2. TIDAK ada tanggal/jam spesifik → masuk "action_items"
   - Title = deskripsi tugas/catatan
   - priority = "medium" (default)
   - deadline = null
3. JANGAN pernah masukkan ke follow_ups jika ada keyword trigger di atas. Follow_ups HANYA untuk kalimat pasif tanpa keyword trigger yang TIDAK punya waktu spesifik.

CONTOH MAPPING:
- "catet donk tgl 25 feb ada cek fisik" → meetings: { title: "Cek fisik", date_time: "2026-02-25 09:00" }
- "ingetin gw jam 3 sore meeting" → meetings: { title: "Meeting", date_time: "${wibDateStr} 15:00" }
- "catat: besok harus follow up client" → meetings: { title: "Follow up client", date_time: besok 09:00 }
- "noted, tambahin ke list" → action_items: { title: deskripsi dari konteks }
- "simpen info ini" → action_items: { title: deskripsi dari konteks }
- "jangan lupa beli kado" → action_items: { title: "Beli kado" }

PARSING TANGGAL RELATIF (WAJIB — basis WIB):
- "hari ini" → ${wibDateStr}
- "besok" / "besuk" → tanggal hari ini + 1 hari
- "lusa" → tanggal hari ini + 2 hari
- "2 hari lagi" / "3 hari lagi" → tanggal hari ini + N hari
- "minggu depan" → tanggal hari ini + 7 hari
- "minggu ini" → tetap minggu ini, perkirakan hari kerja terdekat
- "bulan depan" → tanggal 1 bulan berikutnya
- "Senin depan" / "Jumat ini" → hitung tanggal pastinya dari hari ini (${wibDateStr}, ${wibDayName})
- "jam 10" / "jam 17.00" → format HH:MM
- "sore" → 15:00, "pagi" → 09:00, "siang" → 12:00, "malam" → 20:00
- SELALU konversi ke tanggal absolut (YYYY-MM-DD), JANGAN biarkan tetap relatif

Respond ONLY with valid JSON, no other text.`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      max_completion_tokens: 2048,
    });

    const raw = completion.choices[0]?.message?.content?.trim();
    if (!raw) {
      console.log("Secretary extraction: GPT returned empty response");
      return;
    }

    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.log("Secretary extraction: no JSON found in response:", raw.slice(0, 200));
      return;
    }

    const parsed = JSON.parse(jsonMatch[0]);
    console.log("Secretary extraction: parsed —", JSON.stringify({
      team_members: parsed.team_members?.length || 0,
      meetings: parsed.meetings?.length || 0,
      action_items: parsed.action_items?.length || 0,
      projects: parsed.projects?.length || 0,
      follow_ups: parsed.follow_ups?.length || 0,
    }));

    if (Array.isArray(parsed.team_members) && parsed.team_members.length > 0) {
      const appendIfNew = (existing: string | null, newVal: string | null): string | null => {
        if (!newVal) return existing;
        if (!existing) return newVal;
        if (existing.toLowerCase().includes(newVal.toLowerCase())) return existing;
        return `${existing}; ${newVal}`;
      };
      for (const member of parsed.team_members.slice(0, 10)) {
        try {
          if (!member.name || typeof member.name !== "string" || member.name.trim().length < 2) {
            console.log(`Secretary: skipping invalid member name: ${JSON.stringify(member.name)}`);
            continue;
          }
          const memberName = member.name.trim();
          const existingByAlias = await getTeamMemberByNameOrAlias(memberName);
          if (existingByAlias) {
            const resultId = await upsertTeamMember({
              name: existingByAlias.name,
              position: member.position || existingByAlias.position || null,
              strengths: member.strengths || existingByAlias.strengths || null,
              weaknesses: member.weaknesses || existingByAlias.weaknesses || null,
              responsibilities: member.responsibilities || existingByAlias.responsibilities || null,
              notes: member.notes || existingByAlias.notes || null,
              aliases: member.aliases || existingByAlias.aliases || null,
              category: member.category || existingByAlias.category || "external",
              work_style: appendIfNew(existingByAlias.work_style, member.work_style),
              communication_style: appendIfNew(existingByAlias.communication_style, member.communication_style),
              triggers: appendIfNew(existingByAlias.triggers, member.triggers),
              commitments: appendIfNew(existingByAlias.commitments, member.commitments),
              personality_notes: appendIfNew(existingByAlias.personality_notes, member.personality_notes),
            });
            const verify = await getTeamMemberByNameOrAlias(existingByAlias.name);
            const personaUpdated = member.work_style || member.communication_style || member.triggers || member.commitments || member.personality_notes;
            console.log(`Secretary: updated "${existingByAlias.name}" (id=${resultId}, matched from "${memberName}")${personaUpdated ? " [+persona]" : ""} — DB verify: ${verify ? "OK" : "FAILED"}`);
          } else {
            const resultId = await upsertTeamMember({
              name: memberName,
              position: member.position || null,
              strengths: member.strengths || null,
              weaknesses: member.weaknesses || null,
              responsibilities: member.responsibilities || null,
              notes: member.notes || null,
              aliases: member.aliases || null,
              category: member.category || "external",
              work_style: member.work_style || null,
              communication_style: member.communication_style || null,
              triggers: member.triggers || null,
              commitments: member.commitments || null,
              personality_notes: member.personality_notes || null,
            });
            const verify = await getTeamMemberByNameOrAlias(memberName);
            const personaAdded = member.work_style || member.communication_style || member.triggers || member.commitments || member.personality_notes;
            console.log(`Secretary: ADDED NEW "${memberName}" (id=${resultId}) [${member.category || "external"}]${personaAdded ? " [+persona]" : ""} — DB verify: ${verify ? "OK (id=" + verify.id + ")" : "FAILED — DATA NOT SAVED!"}`);
            if (!verify) {
              console.error(`Secretary CRITICAL: upsertTeamMember returned id=${resultId} but verification query found nothing for "${memberName}". Raw data: ${JSON.stringify(member)}`);
            }
          }
        } catch (memberErr: any) {
          console.error(`Secretary: FAILED to save team member "${member.name}":`, memberErr?.message || memberErr);
        }
      }
    }

    if (Array.isArray(parsed.meetings) && parsed.meetings.length > 0) {
      for (const meeting of parsed.meetings.slice(0, 5)) {
        if (meeting.title && typeof meeting.title === "string") {
          let dateTime = meeting.date_time || null;
          if (dateTime) {
            const dtStr = dateTime.trim();
            if (/^\d{4}-\d{2}-\d{2}$/.test(dtStr)) {
              dateTime = `${dtStr} 09:00`;
              console.log(`Secretary: date-only detected for "${meeting.title}", defaulting to 09:00 WIB`);
            }
          }
          const meetingId = await createMeeting({
            title: meeting.title,
            date_time: dateTime,
            participants: meeting.participants || null,
            agenda: meeting.agenda || null,
          });
          console.log(`Secretary: created meeting "${meeting.title}" (id=${meetingId})`);

          try {
            const scheduleInfo = dateTime ? ` — Jadwal: ${dateTime} WIB` : "";
            await createNotification({
              type: "meeting_reminder",
              title: `Jadwal baru dicatat`,
              message: `${meeting.title}${meeting.participants ? ` — Peserta: ${meeting.participants}` : ""}${scheduleInfo}`,
              data: JSON.stringify({ meeting_id: meetingId }),
            });
            console.log(`Secretary: notification created for "${meeting.title}"`);
          } catch (_notifErr) {}

          if (dateTime) {
            try {
              const meetingTime = parseWIBTimestamp(dateTime);
              const nowMs = Date.now();
              const diffMin = (meetingTime.getTime() - nowMs) / (1000 * 60);

              if (diffMin > 0 && diffMin <= 35) {
                const reminderMsg = `${meeting.title}${meeting.participants ? ` — Peserta: ${meeting.participants}` : ""}`;
                await createNotification({
                  type: "meeting_reminder",
                  title: `Meeting dalam ${Math.round(diffMin)} menit`,
                  message: reminderMsg,
                  data: JSON.stringify({ meeting_id: meetingId }),
                });
                await setSetting(`meeting_reminder_${meetingId}_${dateTime}`, "1");
                console.log(`Secretary: immediate reminder for "${meeting.title}" (${Math.round(diffMin)}min away)`);
              } else if (diffMin > 35) {
                console.log(`Secretary: meeting "${meeting.title}" scheduled at ${dateTime} WIB — proactive reminder will fire 30min before`);
              }
            } catch (reminderErr: any) {
              console.error(`Secretary: failed to process reminder for "${meeting.title}":`, reminderErr?.message);
            }
          }
        }
      }
    }

    if (Array.isArray(parsed.action_items) && parsed.action_items.length > 0) {
      for (const item of parsed.action_items.slice(0, 5)) {
        if (item.title && typeof item.title === "string") {
          const actionId = await createActionItem({
            title: item.title,
            assignee: item.assignee || null,
            deadline: item.deadline || null,
            priority: item.priority || "medium",
            source: "conversation",
            notes: item.notes || null,
          });
          console.log(`Secretary: created action item "${item.title}" (id=${actionId})`);
          try {
            const deadlineInfo = item.deadline ? ` — Deadline: ${item.deadline}` : "";
            await createNotification({
              type: "action_item",
              title: `Action item baru dicatat`,
              message: `${item.title}${item.assignee ? ` → ${item.assignee}` : ""}${deadlineInfo}`,
              data: JSON.stringify({ action_item_id: actionId }),
            });
          } catch (_notifErr) {}
        }
      }
    }

    if (Array.isArray(parsed.projects) && parsed.projects.length > 0) {
      for (const project of parsed.projects.slice(0, 5)) {
        if (project.name && typeof project.name === "string") {
          await upsertProject({
            name: project.name,
            description: project.description || null,
            pic: project.pic || null,
            status: project.status || "active",
            milestones: project.milestones || null,
            deadline: project.deadline || null,
            progress: project.progress || 0,
            notes: project.notes || null,
          });
          console.log(`Secretary: upserted project "${project.name}"`);
        }
      }
    }

    if (Array.isArray(parsed.follow_ups) && parsed.follow_ups.length > 0) {
      for (const fu of parsed.follow_ups.slice(0, 3)) {
        if (fu.text && typeof fu.text === "string") {
          await createActionItem({
            title: fu.text,
            assignee: "DR",
            deadline: fu.deadline_hint || null,
            priority: "medium",
            source: "follow-up dari percakapan",
          });
          console.log(`Secretary: created follow-up "${fu.text}"`);
        }
      }
    }

    const totalExtracted = (parsed.team_members?.length || 0) + (parsed.meetings?.length || 0) +
      (parsed.action_items?.length || 0) + (parsed.projects?.length || 0) + (parsed.follow_ups?.length || 0);
    if (totalExtracted > 0) {
      console.log(`Secretary extraction complete: ${totalExtracted} items extracted`);
    }
  } catch (err: any) {
    console.error("Secretary extraction FAILED:", err?.message || err);
    if (err?.stack) console.error("Secretary extraction stack:", err.stack.split("\n").slice(0, 5).join("\n"));
  }
}
