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
  getPersonaFeedback,
  bulkSavePersonaFeedback,
  clearPersonaFeedback,
  getProfileEnrichments,
  bulkSaveProfileEnrichments,
  clearProfileEnrichments,
  saveConversationTag,
  getConversationTags,
  clearConversationTags,
  getPassword,
  setSetting,
} from "./db";

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
  if (!multiPersona) {
    let cleaned = reply
      .replace(/^Broto:\s*/im, "")
      .replace(/\n\s*Rara:\s*/im, "\n\n")
      .replace(/\n\s*Rere:\s*/im, "\n\n")
      .replace(/\n\s*DR:\s*/im, "\n\n");
    return cleaned.trim();
  }

  const hasBroto = /Broto\s*:/i.test(reply);
  const hasRara = /Rara\s*:/i.test(reply);
  const hasRere = /Rere\s*:/i.test(reply);
  const hasDR = /DR\s*:/i.test(reply);

  if (hasBroto && hasRara && hasRere && hasDR) return reply;

  if (!hasBroto && !hasRara && !hasRere && !hasDR) {
    const sentences = reply.split(/(?<=[.!?])\s+/);
    const quarter = Math.ceil(sentences.length / 4);
    const brotoPart = sentences.slice(0, quarter).join(" ");
    const raraPart = sentences.slice(quarter, quarter * 2).join(" ") || "Saya merasakan ada hal penting di balik pertanyaan ini, mas DR.";
    const rerePart = sentences.slice(quarter * 2, quarter * 3).join(" ") || "Coba lihat dari sudut pandang yang berbeda, mas DR.";
    const drPart = sentences.slice(quarter * 3).join(" ") || "Kalau gw pikir-pikir, ini perlu dilihat dari sisi pengalaman juga.";
    return `Broto: ${brotoPart}\n\nRara: ${raraPart}\n\nRere: ${rerePart}\n\nDR: ${drPart}`;
  }

  const brotoMatch = reply.match(/Broto:\s*([\s\S]*?)(?=\n\s*(?:Rara|Rere|DR)\s*:|$)/i);
  const raraMatch = reply.match(/Rara:\s*([\s\S]*?)(?=\n\s*(?:Rere|DR)\s*:|$)/i);
  const rereMatch = reply.match(/Rere:\s*([\s\S]*?)(?=\n\s*DR\s*:|$)/i);
  const drMatch = reply.match(/DR:\s*([\s\S]*?)$/i);

  const brotoContent = brotoMatch ? brotoMatch[1].trim() : "Perlu dilihat risiko dan konsekuensinya, mas DR.";
  const raraContent = raraMatch ? raraMatch[1].trim() : "Pertimbangkan juga sisi emosional dan jangka panjangnya, mas DR.";
  const rereContent = rereMatch ? rereMatch[1].trim() : "Ada sudut pandang lain yang mungkin belum terpikirkan di sini.";
  const drContent = drMatch ? drMatch[1].trim() : "Dari pengalaman gw, ini perlu dipikirin lebih matang sebelum dieksekusi.";

  return `Broto: ${brotoContent}\n\nRara: ${raraContent}\n\nRere: ${rereContent}\n\nDR: ${drContent}`;
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

async function extractProfileEnrichment(userId: string, userMessage: string) {
  const prompt = `Kamu adalah sistem ekstraksi profil untuk DARVIS. Analisis pesan berikut dan ekstrak fakta-fakta personal tentang DR (Dian Ramadhan) yang disampaikan.

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

    const validCategories = ["persepsi_orang", "tokoh_idola", "film_favorit", "prinsip_spiritual", "karakter_personal", "kebiasaan", "filosofi", "preferensi"];
    const validItems = parsed
      .filter((p: any) =>
        p.category && validCategories.includes(p.category) &&
        p.fact && typeof p.fact === "string" &&
        typeof p.confidence === "number" && p.confidence >= 0.6 && p.confidence <= 1.0
      )
      .slice(0, 10)
      .map((p: any) => ({
        category: p.category as string,
        fact: p.fact as string,
        confidence: p.confidence as number,
        source_quote: (p.source_quote as string) || null,
      }));

    if (validItems.length > 0) {
      bulkSaveProfileEnrichments(userId, validItems);
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
      model: "gpt-5",
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
      bulkSavePersonaFeedback(userId, validItems);
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
  if (!req.session.userId) {
    req.session.userId = `user_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  }
  return req.session.userId;
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  app.post("/api/login", (req, res) => {
    try {
      const { password } = req.body;
      const ownerPassword = getPassword("owner");
      const contributorPassword = getPassword("contributor");

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
      return res.json({ isOwner, isContributor, mode });
    } catch (err: any) {
      console.error("Session info error:", err?.message || err);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/contributor-enrichments", (req, res) => {
    try {
      if (req.session.isOwner !== true) {
        return res.status(403).json({ message: "Owner only" });
      }
      const enrichments = getProfileEnrichments("contributor_shared");
      return res.json({ enrichments });
    } catch (err: any) {
      console.error("Contributor enrichments API error:", err?.message || err);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/change-password", (req, res) => {
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
        const currentOwnerPw = getPassword("owner");
        if (currentOwnerPw && currentPassword !== currentOwnerPw) {
          return res.status(401).json({ success: false, message: "Password lama salah" });
        }
        if (!currentOwnerPw) {
          return res.status(400).json({ success: false, message: "Password owner belum dikonfigurasi" });
        }
      }
      setSetting(`${type}_password`, newPassword);
      return res.json({ success: true, message: `Password ${type === "owner" ? "Owner" : "Contributor"} berhasil diubah` });
    } catch (err: any) {
      console.error("Change password error:", err?.message || err);
      return res.status(500).json({ success: false, message: "Internal server error" });
    }
  });

  app.get("/api/history", (req, res) => {
    try {
      const userId = getUserId(req);
      const msgs = getAllMessages(userId);
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

  app.post("/api/clear", (req, res) => {
    try {
      const userId = getUserId(req);
      clearHistory(userId);
      clearPreferences(userId);
      clearPersonaFeedback(userId);
      clearProfileEnrichments(userId);
      clearConversationTags(userId);
      return res.json({ success: true });
    } catch (err: any) {
      console.error("Clear API error:", err?.message || err);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/conversation-tags", (req, res) => {
    try {
      const userId = getUserId(req);
      const tags = getConversationTags(userId);
      return res.json({ tags });
    } catch (err: any) {
      console.error("Conversation tags API error:", err?.message || err);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/persona-feedback", (req, res) => {
    try {
      const userId = getUserId(req);
      const feedback = getPersonaFeedback(userId);
      return res.json({ feedback });
    } catch (err: any) {
      console.error("Persona feedback API error:", err?.message || err);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/profile-enrichments", (req, res) => {
    try {
      const userId = getUserId(req);
      const enrichments = getProfileEnrichments(userId);
      return res.json({ enrichments });
    } catch (err: any) {
      console.error("Profile enrichments API error:", err?.message || err);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/preferences", (req, res) => {
    try {
      const userId = getUserId(req);
      const preferences = getLearnedPreferences(userId);
      return res.json({ preferences });
    } catch (err: any) {
      console.error("Preferences API error:", err?.message || err);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/seed-profile", async (req, res) => {
    try {
      const userId = getUserId(req);
      const existingPrefs = getLearnedPreferences(userId);
      const hasSeed = existingPrefs.some(p => p.source_summary === "SEED_FROM_PROFILE");
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

      bulkUpsertPreferences(userId, seedPreferences);
      return res.json({ success: true, message: "Profile seeded successfully", count: seedPreferences.length });
    } catch (err: any) {
      console.error("Seed profile error:", err?.message || err);
      return res.status(500).json({ message: "Internal server error" });
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

      const { message, images } = parsed.data;
      const hasImages = images && images.length > 0;

      const corePrompt = readPromptFile("DARVIS_CORE.md");
      if (!corePrompt) {
        return res.status(500).json({ message: "System prompt not found" });
      }

      const drProfile = readPromptFile("DARVIS_PROFILE_DR.md");

      const nodesUsed: string[] = [];
      const isMultiPersonaMode = isOwner ? detectMultiPersonaIntent(message) : false;
      const isDecisionFast = detectDecisionFastMode(message);
      const isStrategicEscalation = detectStrategicEscalation(message);
      const tone = detectConversationTone(message);
      const contextMode = detectContextMode(message, tone);
      const decisionType = classifyDecisionType(message);
      let systemContent = corePrompt;

      if (isOwner) {
        systemContent += `\n\n---\nMODE: MIRROR (Owner). Sapaan: "mas DR"/"lo". Tone lebih tajam.`;
      } else if (isContributor) {
        systemContent += `\n\n---\nMODE: CONTRIBUTOR. User ini adalah orang yang mengenal DR secara personal. Sapaan: "kamu"/"lo". JANGAN tampilkan persona cards. Suara unified seperti Twin Mode. PENTING: Jika user menceritakan sesuatu tentang DR (kebiasaan, karakter, cerita, pendapat tentang DR), DENGARKAN dan RESPONSIF — tanyakan lebih dalam. User ini bisa jadi sumber insight berharga tentang DR.`;
      } else {
        systemContent += `\n\n---\nMODE: TWIN. JANGAN sebut DR/Bapak/Abah/YKW/Raha/identitas personal. Sapaan: "kamu"/"lo".`;
      }

      if (isMultiPersonaMode) {
        systemContent += `\n\n---\nAKTIF: MULTI-PERSONA. Format: Broto: → Rara: → Rere: → DR: (semua HARUS beda sudut pandang).`;
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

      if (drProfile) {
        systemContent += `\n\n---\nPROFIL FONDASI MAS DR (untuk persona DR):\n${drProfile}`;
      }

      let isBias = detectBiasIntent(message);
      const isSolidGroup = detectSolidGroupIntent(message);
      let isAiSG = detectAiSGIntent(message);
      const isNM = detectNMIntent(message);
      const isRiskGuard = detectRiskGuardIntent(message);
      const isCompliance = detectComplianceIntent(message);

      if (tone.emotional && !isBias && !isNM && !isRiskGuard) {
        isBias = true;
      }

      if (tone.evaluative && !isAiSG && !isNM && !isRiskGuard && !isCompliance) {
        isAiSG = true;
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

      if (nodesUsed.length > 0) {
        const resourcePrompt = readPromptFile("DARVIS_NODE_RESOURCES.md");
        if (resourcePrompt) {
          systemContent += `\n\n---\nNODE_RESOURCES:\n${resourcePrompt}`;
          nodesUsed.push("NODE_RESOURCES");
        }
      } else {
        systemContent += `\n\n---\nREFERRAL: Sisipkan referensi relevan di akhir (BIAS bias23.com, AiSG aisg23.replit.app, NM newsmaker.id, NM Ai nm23ai.replit.app). Max 1, natural, bukan iklan.`;
      }

      if (nodesUsed.length > 1) {
        const hasBiasNode = nodesUsed.includes("NODE_BIAS");
        const instruction = hasBiasNode
          ? `Prioritas BIAS → refleksi dulu, turunkan klaim, baru sentuh domain lain.`
          : `Multi-node aktif. Turunkan klaim, bahasa reflektif, bantu lihat dari berbagai sudut.`;
        systemContent += `\n\n---\nMULTI-NODE [${nodesUsed.join(", ")}]: ${instruction}`;
      }

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

      const rawFeedbacks = getPersonaFeedback(userId);
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

      const rawEnrichments = getProfileEnrichments(userId);
      const contributorEnrichments = getProfileEnrichments("contributor_shared");
      const combinedEnrichments = [...rawEnrichments, ...contributorEnrichments];
      const profileEnrichments = applyMemoryGovernor(combinedEnrichments, 5);
      if (profileEnrichments.length > 0) {
        const grouped: Record<string, string[]> = {};
        for (const e of profileEnrichments) {
          if (!grouped[e.category]) grouped[e.category] = [];
          grouped[e.category].push(e.fact);
        }
        let enrichBlock = "\n\n---\nPROFIL DR:\n";
        for (const [cat, facts] of Object.entries(grouped)) {
          const label = ENRICHMENT_CATEGORY_LABELS[cat] || cat;
          enrichBlock += `[${label}]\n`;
          for (const fact of facts) {
            enrichBlock += `- ${fact}\n`;
          }
          enrichBlock += "\n";
        }
        enrichBlock += "Konteks, bukan kebenaran — tetap counter jika perlu.";
        systemContent += enrichBlock;
      }

      const rawPrefs = getLearnedPreferences(userId);
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

      const apiMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];
      apiMessages.push({ role: "system", content: systemContent });

      const summary = getSummary(userId);
      if (summary) {
        apiMessages.push({
          role: "system",
          content: `RINGKASAN PERCAKAPAN SEBELUMNYA:\n${summary}`,
        });
      }

      const contextBudget = nodesUsed.length >= 3 ? 10 : 20;
      const recentMessages = getLastMessages(userId, contextBudget);
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
      const timeout = setTimeout(() => abortController.abort(), 60000);

      try {
        const stream = await openai.chat.completions.create({
          model: "gpt-5",
          messages: apiMessages,
          max_completion_tokens: 2048,
          stream: true,
        }, { signal: abortController.signal });

        let fullReply = "";
        for await (const chunk of stream) {
          const delta = chunk.choices[0]?.delta?.content;
          if (delta) {
            fullReply += delta;
            res.write(`data: ${JSON.stringify({ type: "chunk", content: delta })}\n\n`);
            if (typeof (res as any).flush === "function") {
              (res as any).flush();
            }
          }
        }
        clearTimeout(timeout);

        const presentationMode = isOwner ? "mirror" : isContributor ? "contributor" : "twin";
        let reply: string;
        if (!fullReply.trim()) {
          reply = isMultiPersonaMode
            ? "Broto: Maaf mas DR, saya butuh waktu untuk memproses pertanyaan ini. Bisa coba ulangi?\n\nRara: Tenang mas DR, kadang perlu pendekatan berbeda. Coba sampaikan pertanyaan dengan cara lain ya.\n\nRere: Mungkin coba tanya dari sudut yang berbeda, kadang itu bantu.\n\nDR: Gw juga kadang gitu — coba rephrase aja, biar kita bisa jalan lagi."
            : "Maaf, gw butuh waktu untuk memproses pertanyaan ini. Coba ulangi atau rephrase ya.";
          if (!isOwner) {
            reply = mergePersonasToUnifiedVoice(reply);
          }
          res.write(`data: ${JSON.stringify({ type: "done", nodeUsed, contextMode, presentationMode, fullReply: reply })}\n\n`);
        } else {
          reply = enforceFormat(fullReply, isMultiPersonaMode);
          if (!isOwner) {
            reply = mergePersonasToUnifiedVoice(reply);
          }
          res.write(`data: ${JSON.stringify({ type: "done", nodeUsed, contextMode, presentationMode, fullReply: (!isOwner || isContributor) ? reply : undefined })}\n\n`);
        }
        res.end();

        saveMessage(userId, "user", message);
        saveMessage(userId, "assistant", reply);

        try {
          const toneSignalsForTag: string[] = [];
          if (tone.emotional) toneSignalsForTag.push("emosional");
          if (tone.analytical) toneSignalsForTag.push("analitis");
          if (tone.evaluative) toneSignalsForTag.push("evaluatif");
          if (tone.urgent) toneSignalsForTag.push("urgensi");

          saveConversationTag(userId, {
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
          extractProfileEnrichment("contributor_shared", message).catch((err) => {
            console.error("Contributor enrichment error:", err?.message || err);
          });
        } else if (detectDRIdentity(message)) {
          extractProfileEnrichment(userId, message).catch((err) => {
            console.error("Profile enrichment error:", err?.message || err);
          });
        }

        const msgCount = getMessageCount(userId);
        if (msgCount > 0 && msgCount % 20 === 0) {
          generateSummary(userId).catch((err) => {
            console.error("Auto-summary error:", err?.message || err);
          });
        }

        if (msgCount > 0 && msgCount % 10 === 0) {
          extractPreferences(userId).catch((err) => {
            console.error("Auto-learn error:", err?.message || err);
          });
        }
      } catch (streamErr: any) {
        clearTimeout(timeout);
        if (!res.headersSent) {
          return res.status(500).json({ message: "Internal server error" });
        }
        res.write(`data: ${JSON.stringify({ type: "error", message: "Koneksi terputus. Coba lagi ya." })}\n\n`);
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
