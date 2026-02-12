import { useState, useRef, useEffect, useCallback } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Send, Trash2, Loader2, Lightbulb, X, Shield, Heart, Sparkles, User, Fingerprint, Mic, MicOff, ImagePlus, Lock, LogOut, Download } from "lucide-react";
import ReactMarkdown from "react-markdown";
import type { ChatMessage, ChatResponse, HistoryResponse, PreferencesResponse, PersonaFeedbackResponse, ProfileEnrichmentsResponse } from "@shared/schema";

function MarkdownContent({ content, className = "" }: { content: string; className?: string }) {
  return (
    <div className={`markdown-content text-[13px] sm:text-sm leading-relaxed ${className}`}>
      <ReactMarkdown
        components={{
          p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
          strong: ({ children }) => <strong className="font-bold">{children}</strong>,
          em: ({ children }) => <em className="italic">{children}</em>,
          h1: ({ children }) => <h1 className="text-base font-bold mb-2 mt-3 first:mt-0">{children}</h1>,
          h2: ({ children }) => <h2 className="text-[15px] font-bold mb-1.5 mt-2.5 first:mt-0">{children}</h2>,
          h3: ({ children }) => <h3 className="text-[14px] font-semibold mb-1 mt-2 first:mt-0">{children}</h3>,
          ul: ({ children }) => <ul className="list-disc pl-5 mb-2 space-y-0.5">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal pl-5 mb-2 space-y-0.5">{children}</ol>,
          li: ({ children }) => <li className="mb-0.5">{children}</li>,
          blockquote: ({ children }) => <blockquote className="border-l-2 border-muted-foreground/30 pl-3 my-2 italic text-muted-foreground">{children}</blockquote>,
          code: ({ children, className: codeClassName }) => {
            const isBlock = codeClassName?.includes("language-");
            if (isBlock) {
              return <pre className="bg-muted/50 rounded-md p-2.5 my-2 overflow-x-auto text-xs"><code>{children}</code></pre>;
            }
            return <code className="bg-muted/50 rounded px-1.5 py-0.5 text-xs font-mono">{children}</code>;
          },
          hr: () => <hr className="my-3 border-muted-foreground/20" />,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

interface ParsedVoices {
  broto: string | null;
  rara: string | null;
  rere: string | null;
  dr: string | null;
}

function parseQuadVoice(text: string): ParsedVoices | null {
  const brotoMatch = text.match(/Broto:\s*([\s\S]*?)(?=\n\s*(?:Rara|Rere|DR)\s*:|$)/i);
  const raraMatch = text.match(/Rara:\s*([\s\S]*?)(?=\n\s*(?:Rere|DR)\s*:|$)/i);
  const rereMatch = text.match(/Rere:\s*([\s\S]*?)(?=\n\s*DR\s*:|$)/i);
  const drMatch = text.match(/DR:\s*([\s\S]*?)$/i);

  const hasAny = brotoMatch || raraMatch || rereMatch || drMatch;
  if (!hasAny) return null;

  return {
    broto: brotoMatch ? brotoMatch[1].trim() : null,
    rara: raraMatch ? raraMatch[1].trim() : null,
    rere: rereMatch ? rereMatch[1].trim() : null,
    dr: drMatch ? drMatch[1].trim() : null,
  };
}

const PERSONA_CONFIG = {
  broto: {
    label: "Broto",
    subtitle: "Logis & Tegas",
    icon: Shield,
    bgClass: "bg-blue-500/10 dark:bg-blue-400/10",
    textClass: "text-blue-600 dark:text-blue-400",
    accentClass: "bg-blue-500 dark:bg-blue-400",
  },
  rara: {
    label: "Rara",
    subtitle: "Reflektif & Empatik",
    icon: Heart,
    bgClass: "bg-rose-500/10 dark:bg-rose-400/10",
    textClass: "text-rose-600 dark:text-rose-400",
    accentClass: "bg-rose-500 dark:bg-rose-400",
  },
  rere: {
    label: "Rere",
    subtitle: "Kreatif & Alternatif",
    icon: Sparkles,
    bgClass: "bg-amber-500/10 dark:bg-amber-400/10",
    textClass: "text-amber-600 dark:text-amber-400",
    accentClass: "bg-amber-500 dark:bg-amber-400",
  },
  dr: {
    label: "DR",
    subtitle: "Digital Twin",
    icon: User,
    bgClass: "bg-emerald-500/10 dark:bg-emerald-400/10",
    textClass: "text-emerald-600 dark:text-emerald-400",
    accentClass: "bg-emerald-500 dark:bg-emerald-400",
  },
} as const;

function PersonaCard({ persona, content, index }: { persona: keyof typeof PERSONA_CONFIG; content: string; index: number }) {
  const config = PERSONA_CONFIG[persona];
  const Icon = config.icon;

  return (
    <div className="flex gap-0">
      <div className={`w-1 shrink-0 rounded-full ${config.accentClass} opacity-40`} />
      <Card className="p-2.5 sm:p-3 bg-card border-card-border flex-1 ml-2">
        <div className="flex items-center gap-2 mb-1.5">
          <div className={`w-5 h-5 rounded-md ${config.bgClass} flex items-center justify-center shrink-0`} data-testid={`icon-${persona}-${index}`}>
            <Icon className={`w-3 h-3 ${config.textClass}`} />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className={`text-xs font-semibold ${config.textClass}`} data-testid={`label-${persona}-${index}`}>{config.label}</span>
            <span className="text-[9px] text-muted-foreground hidden sm:inline">{config.subtitle}</span>
          </div>
        </div>
        <div data-testid={`text-${persona}-${index}`}>
          <MarkdownContent content={content} />
        </div>
      </Card>
    </div>
  );
}

function AssistantBubble({ content, index, isOwner }: { content: string; index: number; isOwner: boolean }) {
  const parsed = isOwner ? parseQuadVoice(content) : null;

  if (parsed && (parsed.broto || parsed.rara || parsed.rere || parsed.dr)) {
    return (
      <div className="flex flex-col gap-2 max-w-full sm:max-w-[85%] md:max-w-[75%]" data-testid={`bubble-assistant-${index}`}>
        {parsed.broto && <PersonaCard persona="broto" content={parsed.broto} index={index} />}
        {parsed.rara && <PersonaCard persona="rara" content={parsed.rara} index={index} />}
        {parsed.rere && <PersonaCard persona="rere" content={parsed.rere} index={index} />}
        {parsed.dr && <PersonaCard persona="dr" content={parsed.dr} index={index} />}
      </div>
    );
  }

  return (
    <Card className="p-2.5 sm:p-3 max-w-full sm:max-w-[85%] md:max-w-[75%] bg-card border-card-border" data-testid={`bubble-assistant-${index}`}>
      <div data-testid={`text-assistant-${index}`}>
        <MarkdownContent content={content} />
      </div>
    </Card>
  );
}

function UserBubble({ content, index, images }: { content: string; index: number; images?: string[] }) {
  return (
    <div className="flex justify-end" data-testid={`bubble-user-${index}`}>
      <div className="px-3 py-2 rounded-md bg-primary text-primary-foreground max-w-[90%] sm:max-w-[75%]">
        {images && images.length > 0 && (
          <div className={`flex flex-wrap gap-1.5 mb-2 ${images.length === 1 ? "" : "grid grid-cols-2"}`} data-testid={`images-user-${index}`}>
            {images.map((img, imgIdx) => (
              <img
                key={imgIdx}
                src={img}
                alt={`Gambar ${imgIdx + 1}`}
                className="rounded-sm max-h-48 object-cover w-full"
                data-testid={`img-user-${index}-${imgIdx}`}
              />
            ))}
          </div>
        )}
        <p className="text-[13px] sm:text-sm leading-relaxed whitespace-pre-wrap" data-testid={`text-user-${index}`}>{content}</p>
      </div>
    </div>
  );
}

const CONTEXT_MODE_LABELS: Record<string, { label: string; color: string }> = {
  strategic: { label: "Strategic", color: "text-purple-500 dark:text-purple-400" },
  tactical: { label: "Tactical", color: "text-sky-500 dark:text-sky-400" },
  reflection: { label: "Reflection", color: "text-rose-500 dark:text-rose-400" },
  crisis: { label: "Crisis", color: "text-red-500 dark:text-red-400" },
};

function TypingIndicator() {
  return (
    <div className="flex items-center gap-2 max-w-full sm:max-w-[75%]" data-testid="status-typing">
      <Card className="p-2.5 sm:p-3 bg-card border-card-border">
        <div className="flex items-center gap-2">
          <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
          <span className="text-xs text-muted-foreground" data-testid="text-typing-status">DARVIS sedang berpikir...</span>
        </div>
      </Card>
    </div>
  );
}

function ContextModeBadge({ mode }: { mode: string }) {
  const config = CONTEXT_MODE_LABELS[mode];
  if (!config) return null;
  return (
    <span className={`text-[10px] font-medium ${config.color} opacity-70`} data-testid={`badge-context-mode-${mode}`}>
      {config.label} mode
    </span>
  );
}

const ENRICHMENT_LABELS: Record<string, string> = {
  persepsi_orang: "Persepsi Orang Lain",
  tokoh_idola: "Tokoh Idola & Inspirasi",
  film_favorit: "Film Favorit",
  prinsip_spiritual: "Spiritual & Religius",
  karakter_personal: "Karakter Personal",
  kebiasaan: "Kebiasaan",
  filosofi: "Filosofi Hidup",
  preferensi: "Preferensi & Selera",
};

const CATEGORY_LABELS: Record<string, string> = {
  gaya_berpikir: "Gaya Berpikir",
  preferensi_komunikasi: "Preferensi Komunikasi",
  konteks_bisnis: "Konteks Bisnis",
  pola_keputusan: "Pola Keputusan",
  area_fokus: "Area Fokus",
  koreksi_penting: "Koreksi Penting",
  gaya_kepemimpinan: "Gaya Kepemimpinan",
  pola_stres: "Pola Stres",
  area_blind_spot: "Area Blind Spot",
  prinsip_hidup: "Prinsip Hidup",
  filosofi_bisnis: "Filosofi Bisnis",
  gaya_bahasa: "Gaya Bahasa",
};

function parseSSELine(line: string): { type: string; content?: string; nodeUsed?: string | null; contextMode?: string | null; fullReply?: string; message?: string } | null {
  if (!line.startsWith("data: ")) return null;
  try {
    return JSON.parse(line.slice(6));
  } catch {
    return null;
  }
}

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [showPrefs, setShowPrefs] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const [attachedImages, setAttachedImages] = useState<string[]>([]);
  const [isOwner, setIsOwner] = useState(false);
  const [isContributor, setIsContributor] = useState(false);
  const [showLoginPanel, setShowLoginPanel] = useState(false);
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [showDownloadMenu, setShowDownloadMenu] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const downloadMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showDownloadMenu) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (downloadMenuRef.current && !downloadMenuRef.current.contains(e.target as Node)) {
        setShowDownloadMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showDownloadMenu]);

  const { data: sessionData } = useQuery<{ isOwner: boolean; isContributor: boolean; mode: string }>({
    queryKey: ["/api/session-info"],
  });

  useEffect(() => {
    if (sessionData) {
      setIsOwner(sessionData.isOwner);
      setIsContributor(sessionData.isContributor);
    }
  }, [sessionData]);

  const { data: historyData, isLoading: historyLoading } = useQuery<HistoryResponse>({
    queryKey: ["/api/history"],
  });

  const { data: prefsData } = useQuery<PreferencesResponse>({
    queryKey: ["/api/preferences"],
    refetchInterval: 30000,
  });

  const { data: feedbackData } = useQuery<PersonaFeedbackResponse>({
    queryKey: ["/api/persona-feedback"],
    refetchInterval: 30000,
  });

  const { data: enrichmentData } = useQuery<ProfileEnrichmentsResponse>({
    queryKey: ["/api/profile-enrichments"],
    refetchInterval: 30000,
  });

  useEffect(() => {
    if (historyData?.messages) {
      setMessages(historyData.messages);
    }
  }, [historyData]);

  useEffect(() => {
    apiRequest("POST", "/api/seed-profile").catch(() => {});
  }, []);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      setVoiceSupported(true);
      const recognition = new SpeechRecognition();
      recognition.lang = "id-ID";
      recognition.continuous = true;
      recognition.interimResults = true;

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        let finalTranscript = "";
        let interimTranscript = "";
        for (let i = 0; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript + " ";
          } else {
            interimTranscript += transcript;
          }
        }
        setInput((finalTranscript + interimTranscript).trim());
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        if (event.error !== "aborted") {
          setIsListening(false);
        }
      };

      recognitionRef.current = recognition;
    }

    return () => {
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch {}
      }
    };
  }, []);

  const toggleVoice = useCallback(() => {
    if (!recognitionRef.current) return;
    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      setInput("");
      recognitionRef.current.start();
      setIsListening(true);
    }
  }, [isListening]);

  const handleLogin = useCallback(async () => {
    setLoginError("");
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: loginPassword }),
        credentials: "include",
      });
      const data = await res.json();
      if (data.success) {
        if (data.mode === "mirror") {
          setIsOwner(true);
          setIsContributor(false);
        } else if (data.mode === "contributor") {
          setIsContributor(true);
          setIsOwner(false);
        }
        setShowLoginPanel(false);
        setLoginPassword("");
        queryClient.invalidateQueries({ queryKey: ["/api/session-info"] });
        queryClient.invalidateQueries({ queryKey: ["/api/history"] });
      } else {
        setLoginError(data.message || "Password salah");
      }
    } catch {
      setLoginError("Gagal koneksi ke server");
    }
  }, [loginPassword]);

  const handleLogout = useCallback(async () => {
    try {
      await fetch("/api/logout", { method: "POST", credentials: "include" });
      setIsOwner(false);
      setIsContributor(false);
      queryClient.invalidateQueries({ queryKey: ["/api/session-info"] });
      queryClient.invalidateQueries({ queryKey: ["/api/history"] });
    } catch {}
  }, []);

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [currentContextMode, setCurrentContextMode] = useState<string | null>(null);

  const sendMessage = useCallback(async (payload: { message: string; images?: string[] }) => {
    setIsStreaming(true);
    setStreamingContent("");

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        credentials: "include",
      });

      if (!response.ok || !response.body) {
        throw new Error("Stream request failed");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const parsed = parseSSELine(line);
          if (!parsed) continue;

          if (parsed.type === "chunk" && parsed.content) {
            accumulated += parsed.content;
            setStreamingContent(accumulated);
          } else if (parsed.type === "done") {
            const finalContent = parsed.fullReply || accumulated;
            setMessages((prev) => [...prev, { role: "assistant", content: finalContent }]);
            setStreamingContent("");
            if (parsed.contextMode) setCurrentContextMode(parsed.contextMode);
            else setCurrentContextMode(null);
          } else if (parsed.type === "error") {
            setMessages((prev) => [...prev, {
              role: "assistant",
              content: parsed.message || "Koneksi terputus. Coba lagi ya.",
            }]);
            setStreamingContent("");
          }
        }
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Maaf, ada gangguan teknis. Coba ulangi ya — kadang koneksi memang perlu waktu.",
        },
      ]);
      setStreamingContent("");
    } finally {
      setIsStreaming(false);
      inputRef.current?.focus();
      setTimeout(scrollToBottom, 50);
    }
  }, [scrollToBottom]);

  useEffect(() => {
    if (isStreaming) {
      scrollToBottom();
    }
  }, [isStreaming, streamingContent, scrollToBottom]);

  const clearMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/clear");
    },
    onSuccess: () => {
      setMessages([]);
      queryClient.invalidateQueries({ queryKey: ["/api/history"] });
      queryClient.invalidateQueries({ queryKey: ["/api/preferences"] });
      queryClient.invalidateQueries({ queryKey: ["/api/persona-feedback"] });
      queryClient.invalidateQueries({ queryKey: ["/api/profile-enrichments"] });
      inputRef.current?.focus();
    },
  });

  const processImageFile = useCallback((file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      if (!file.type.startsWith("image/")) {
        reject(new Error("Bukan file gambar"));
        return;
      }
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error("Gagal membaca file"));
      reader.readAsDataURL(file);
    });
  }, []);

  const addImages = useCallback(async (files: File[]) => {
    const imageFiles = files.filter((f) => f.type.startsWith("image/"));
    if (imageFiles.length === 0) return;
    const maxTotal = 5;
    const toProcess = imageFiles.slice(0, maxTotal - attachedImages.length);
    if (toProcess.length === 0) return;
    const results = await Promise.all(toProcess.map(processImageFile));
    setAttachedImages((prev) => [...prev, ...results].slice(0, maxTotal));
  }, [attachedImages.length, processImageFile]);

  const removeImage = useCallback((idx: number) => {
    setAttachedImages((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    const imageFiles: File[] = [];
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith("image/")) {
        const file = items[i].getAsFile();
        if (file) imageFiles.push(file);
      }
    }
    if (imageFiles.length > 0) {
      e.preventDefault();
      addImages(imageFiles);
    }
  }, [addImages]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      addImages(Array.from(files));
    }
    e.target.value = "";
  }, [addImages]);

  const formatMessagesAsMD = useCallback((msgs: ChatMessage[]): string => {
    const now = new Date();
    const dateStr = now.toLocaleDateString("id-ID", { year: "numeric", month: "long", day: "numeric" });
    const timeStr = now.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
    let md = `# Percakapan DARVIS\n\n**Tanggal**: ${dateStr} ${timeStr}\n**Total pesan**: ${msgs.length}\n\n---\n\n`;
    msgs.forEach((msg) => {
      if (msg.role === "user") {
        md += `### Kamu\n\n${msg.content}\n\n`;
      } else {
        md += `### DARVIS\n\n${msg.content}\n\n`;
      }
      md += "---\n\n";
    });
    return md;
  }, []);

  const markdownToHtml = useCallback((text: string): string => {
    let html = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
    html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
    html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
    html = html.replace(/^&gt; (.+)$/gm, '<blockquote>$1</blockquote>');
    const lines = html.split('\n');
    let result = '';
    let inUl = false;
    let inOl = false;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const ulMatch = line.match(/^[-*] (.+)$/);
      const olMatch = line.match(/^\d+\. (.+)$/);
      if (ulMatch) {
        if (!inUl) { result += '<ul>'; inUl = true; }
        if (inOl) { result += '</ol>'; inOl = false; }
        result += `<li>${ulMatch[1]}</li>`;
      } else if (olMatch) {
        if (!inOl) { result += '<ol>'; inOl = true; }
        if (inUl) { result += '</ul>'; inUl = false; }
        result += `<li>${olMatch[1]}</li>`;
      } else {
        if (inUl) { result += '</ul>'; inUl = false; }
        if (inOl) { result += '</ol>'; inOl = false; }
        if (line.trim() === '') {
          result += '<br/>';
        } else if (!line.startsWith('<h') && !line.startsWith('<blockquote')) {
          result += `<p>${line}</p>`;
        } else {
          result += line;
        }
      }
    }
    if (inUl) result += '</ul>';
    if (inOl) result += '</ol>';
    return result;
  }, []);

  const formatMessagesAsPDFHTML = useCallback((msgs: ChatMessage[]): string => {
    const now = new Date();
    const dateStr = now.toLocaleDateString("id-ID", { year: "numeric", month: "long", day: "numeric" });
    const timeStr = now.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
    const logoUrl = window.location.origin + "/darvis-logo.png";
    let html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Laporan DARVIS</title><style>
      @page { margin: 20mm 15mm 25mm 15mm; }
      body { font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, sans-serif; max-width: 700px; margin: 0 auto; padding: 0 20px; color: #1a1a1a; font-size: 13px; line-height: 1.65; }
      .report-header { display: flex; align-items: center; gap: 16px; padding: 20px 0 16px 0; border-bottom: 2px solid #1a1a1a; margin-bottom: 24px; }
      .report-header img { width: 48px; height: 48px; border-radius: 6px; object-fit: cover; }
      .report-header-text { flex: 1; }
      .report-header-text h1 { font-size: 18px; font-weight: 700; margin: 0 0 2px 0; letter-spacing: 0.5px; }
      .report-header-text .subtitle { font-size: 11px; color: #666; margin: 0; text-transform: uppercase; letter-spacing: 1px; }
      .report-meta { display: flex; justify-content: space-between; font-size: 11px; color: #888; margin-bottom: 20px; padding-bottom: 12px; border-bottom: 1px solid #e5e5e5; }
      .msg { margin-bottom: 14px; padding: 12px 16px; border-radius: 6px; page-break-inside: avoid; }
      .user { background: #eef1f6; border-left: 3px solid #4a6fa5; }
      .assistant { background: #f9f9f9; border-left: 3px solid #2d8a56; }
      .role { font-weight: 700; font-size: 10px; margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.8px; }
      .role-user { color: #4a6fa5; }
      .role-assistant { color: #2d8a56; }
      .content h1 { font-size: 16px; font-weight: 700; margin: 12px 0 6px 0; }
      .content h2 { font-size: 15px; font-weight: 700; margin: 10px 0 5px 0; }
      .content h3 { font-size: 14px; font-weight: 600; margin: 8px 0 4px 0; }
      .content p { margin: 0 0 6px 0; }
      .content p:last-child { margin-bottom: 0; }
      .content strong { font-weight: 700; }
      .content em { font-style: italic; }
      .content code { background: #e8e8e8; border-radius: 3px; padding: 1px 5px; font-family: 'Consolas', 'Monaco', monospace; font-size: 12px; }
      .content ul, .content ol { margin: 6px 0; padding-left: 20px; }
      .content li { margin-bottom: 3px; }
      .content blockquote { border-left: 3px solid #ccc; padding-left: 12px; margin: 8px 0; color: #555; font-style: italic; }
      .content br { display: block; margin: 4px 0; content: ''; }
      .report-footer { margin-top: 32px; padding-top: 12px; border-top: 1px solid #e5e5e5; text-align: center; font-size: 10px; color: #aaa; }
      @media print { body { padding: 0; } .report-header { padding-top: 0; } }
    </style></head><body>
    <div class="report-header">
      <img src="${logoUrl}" alt="DARVIS" />
      <div class="report-header-text">
        <h1>DARVIS</h1>
        <p class="subtitle">Thinking Framework Distributor</p>
      </div>
    </div>
    <div class="report-meta">
      <span>${dateStr}, ${timeStr}</span>
      <span>${msgs.length} pesan</span>
    </div>`;
    msgs.forEach((msg) => {
      const roleLabel = msg.role === "user" ? "Kamu" : "DARVIS";
      const cls = msg.role === "user" ? "user" : "assistant";
      const roleCls = msg.role === "user" ? "role-user" : "role-assistant";
      const rendered = markdownToHtml(msg.content);
      html += `<div class="msg ${cls}"><div class="role ${roleCls}">${roleLabel}</div><div class="content">${rendered}</div></div>`;
    });
    html += `<div class="report-footer">DARVIS &mdash; Thinking Framework Distributor &mdash; &copy; ${now.getFullYear()}</div>`;
    html += `</body></html>`;
    return html;
  }, [markdownToHtml]);

  const downloadFile = useCallback((content: string, filename: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, []);

  const handleDownload = useCallback((format: "md" | "pdf", scope: "last" | "all") => {
    setShowDownloadMenu(false);
    const msgs = scope === "last"
      ? (() => {
          const lastUserIdx = messages.length - 1 - [...messages].reverse().findIndex((m) => m.role === "user");
          return lastUserIdx >= 0 && lastUserIdx < messages.length ? messages.slice(lastUserIdx) : messages.slice(-2);
        })()
      : messages;
    if (msgs.length === 0) return;

    const timestamp = new Date().toISOString().slice(0, 10);
    if (format === "md") {
      downloadFile(formatMessagesAsMD(msgs), `darvis-${scope === "last" ? "terakhir" : "lengkap"}-${timestamp}.md`, "text/markdown;charset=utf-8");
    } else {
      const html = formatMessagesAsPDFHTML(msgs);
      const printWindow = window.open("", "_blank");
      if (printWindow) {
        printWindow.document.write(html);
        printWindow.document.close();
        setTimeout(() => { printWindow.print(); }, 500);
      }
    }
  }, [messages, formatMessagesAsMD, formatMessagesAsPDFHTML, downloadFile]);

  const handleSend = () => {
    const trimmed = input.trim();
    const hasContent = trimmed || attachedImages.length > 0;
    if (!hasContent || isStreaming) return;

    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
    }

    const msgText = trimmed || "Tolong analisa gambar ini";
    const currentImages = attachedImages.length > 0 ? [...attachedImages] : undefined;
    const userMsg: ChatMessage = { role: "user", content: msgText, images: currentImages };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setAttachedImages([]);

    sendMessage({ message: msgText, images: currentImages });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-[100dvh] bg-background" data-testid="page-chat">
      <header className="flex items-center justify-between gap-2 px-3 sm:px-4 py-2 sm:py-3 border-b shrink-0" data-testid="header-darvis">
        <div className="flex items-center gap-2" data-testid="header-brand">
          <img src="/darvis-logo.png" alt="DARVIS" className="w-7 h-7 sm:w-8 sm:h-8 rounded-md object-cover" />
          <div>
            <h1 className="text-sm font-bold tracking-tight leading-none" data-testid="text-app-title">DARVIS</h1>
            <p className="text-[10px] text-muted-foreground leading-tight mt-0.5" data-testid="text-app-version">
              {isOwner ? "Mirror Mode" : isContributor ? "Contributor Mode" : "Thinking Companion"} v2.0
            </p>
          </div>
        </div>
        <div className="flex items-center gap-0.5 sm:gap-1">
          {(isOwner || isContributor) ? (
            <Button
              variant="ghost"
              size="icon"
              onClick={handleLogout}
              data-testid="button-logout"
              title={isOwner ? "Logout Mirror Mode" : "Logout Contributor Mode"}
            >
              <LogOut className="w-4 h-4" />
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => { setShowLoginPanel(!showLoginPanel); setLoginError(""); setLoginPassword(""); }}
              className={`toggle-elevate ${showLoginPanel ? "toggle-elevated" : ""}`}
              data-testid="button-login"
              title="Login"
            >
              <Lock className="w-4 h-4" />
            </Button>
          )}
          {isOwner && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowPrefs(!showPrefs)}
              className={`toggle-elevate ${showPrefs ? "toggle-elevated" : ""}`}
              data-testid="button-show-preferences"
            >
              <Lightbulb className="w-4 h-4" />
            </Button>
          )}
          <div className="relative" ref={downloadMenuRef}>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowDownloadMenu(!showDownloadMenu)}
              disabled={messages.length === 0}
              className={`toggle-elevate ${showDownloadMenu ? "toggle-elevated" : ""}`}
              data-testid="button-download"
              title="Download percakapan"
            >
              <Download className="w-4 h-4" />
            </Button>
            {showDownloadMenu && (
              <div className="absolute right-0 top-full mt-1 w-52 rounded-md border bg-card shadow-md z-50 py-1" data-testid="menu-download">
                <p className="px-3 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Percakapan Terakhir</p>
                <button onClick={() => handleDownload("md", "last")} className="w-full text-left px-3 py-1.5 text-xs hover-elevate" data-testid="button-download-last-md">
                  Markdown (.md)
                </button>
                <button onClick={() => handleDownload("pdf", "last")} className="w-full text-left px-3 py-1.5 text-xs hover-elevate" data-testid="button-download-last-pdf">
                  PDF (print)
                </button>
                <div className="border-t my-1" />
                <p className="px-3 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Seluruh Percakapan</p>
                <button onClick={() => handleDownload("md", "all")} className="w-full text-left px-3 py-1.5 text-xs hover-elevate" data-testid="button-download-all-md">
                  Markdown (.md)
                </button>
                <button onClick={() => handleDownload("pdf", "all")} className="w-full text-left px-3 py-1.5 text-xs hover-elevate" data-testid="button-download-all-pdf">
                  PDF (print)
                </button>
              </div>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => clearMutation.mutate()}
            disabled={messages.length === 0 || clearMutation.isPending}
            data-testid="button-clear-chat"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </header>

      {showLoginPanel && !isOwner && !isContributor && (
        <div className="border-b px-4 py-3 bg-card/50" data-testid="panel-login">
          <div className="max-w-sm mx-auto flex flex-col gap-2">
            <p className="text-xs text-muted-foreground">Masukkan password untuk masuk</p>
            <div className="flex gap-2">
              <Input
                type="password"
                placeholder="Password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleLogin(); }}
                data-testid="input-login-password"
              />
              <Button onClick={handleLogin} data-testid="button-submit-login">
                Masuk
              </Button>
            </div>
            {loginError && (
              <p className="text-xs text-destructive" data-testid="text-login-error">{loginError}</p>
            )}
          </div>
        </div>
      )}

      {showPrefs && isOwner && (
        <div className="fixed inset-0 z-50 sm:relative sm:inset-auto sm:z-auto flex flex-col bg-background sm:bg-card/50 sm:border-b sm:max-h-[40vh] pt-[env(safe-area-inset-top,0px)] sm:pt-0" data-testid="panel-preferences">
          <div className="flex items-center justify-between gap-2 px-4 py-3 border-b sm:border-b-0 shrink-0">
            <div className="flex items-center gap-2">
              <Lightbulb className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-semibold" data-testid="text-prefs-title">Yang DARVIS Pelajari</h3>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setShowPrefs(false)} data-testid="button-close-preferences">
              <X className="w-4 h-4" />
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto px-4 pb-4 sm:pb-3">
            <div className="max-w-2xl mx-auto">
              {(!prefsData?.preferences || prefsData.preferences.length === 0) ? (
                <p className="text-xs text-muted-foreground py-2" data-testid="text-prefs-empty">
                  Belum ada insight yang dipelajari. DARVIS akan mulai belajar setelah beberapa percakapan.
                </p>
              ) : (
                <div className="space-y-3 sm:space-y-2" data-testid="container-prefs-list">
                  {Object.entries(
                    prefsData.preferences.reduce<Record<string, typeof prefsData.preferences>>((acc, p) => {
                      if (!acc[p.category]) acc[p.category] = [];
                      acc[p.category].push(p);
                      return acc;
                    }, {})
                  ).map(([category, items]) => (
                    <div key={category} data-testid={`prefs-group-${category}`}>
                      <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                        {CATEGORY_LABELS[category] || category}
                      </p>
                      {items.map((item) => (
                        <div key={item.id} className="flex items-start gap-2 py-1" data-testid={`pref-item-${item.id}`}>
                          <div className="w-1.5 h-1.5 rounded-full bg-primary/50 mt-1.5 shrink-0" />
                          <p className="text-[13px] sm:text-xs leading-relaxed">{item.insight}</p>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}

              {enrichmentData?.enrichments && enrichmentData.enrichments.length > 0 && (
                <div className="mt-4 pt-3 border-t" data-testid="container-profile-enrichments">
                  <div className="flex items-center gap-2 mb-2">
                    <Fingerprint className="w-3.5 h-3.5 text-violet-500" />
                    <h4 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Profil DR dari Percakapan</h4>
                  </div>
                  {Object.entries(
                    enrichmentData.enrichments.reduce<Record<string, typeof enrichmentData.enrichments>>((acc, e) => {
                      if (!acc[e.category]) acc[e.category] = [];
                      acc[e.category].push(e);
                      return acc;
                    }, {})
                  ).map(([category, items]) => (
                    <div key={category} className="mb-2" data-testid={`enrichment-group-${category}`}>
                      <p className="text-[11px] font-semibold text-violet-600 dark:text-violet-400 mb-1">
                        {ENRICHMENT_LABELS[category] || category}
                      </p>
                      {items.map((item) => (
                        <div key={item.id} className="flex items-start gap-2 py-0.5" data-testid={`enrichment-item-${item.id}`}>
                          <div className="w-1.5 h-1.5 rounded-full bg-violet-400/60 mt-1.5 shrink-0" />
                          <p className="text-[13px] sm:text-xs leading-relaxed">{item.fact}</p>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}

              {feedbackData?.feedback && feedbackData.feedback.length > 0 && (
                <div className="mt-4 pt-3 border-t" data-testid="container-persona-feedback">
                  <div className="flex items-center gap-2 mb-2">
                    <User className="w-3.5 h-3.5 text-emerald-500" />
                    <h4 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Kesan Orang Lain</h4>
                  </div>
                  {Object.entries(
                    feedbackData.feedback.reduce<Record<string, typeof feedbackData.feedback>>((acc, fb) => {
                      if (!acc[fb.target]) acc[fb.target] = [];
                      acc[fb.target].push(fb);
                      return acc;
                    }, {})
                  ).map(([target, items]) => {
                    const label = target === "dr" ? "DR" : target.charAt(0).toUpperCase() + target.slice(1);
                    const config = target === "dr" ? PERSONA_CONFIG.dr : target === "broto" ? PERSONA_CONFIG.broto : target === "rara" ? PERSONA_CONFIG.rara : PERSONA_CONFIG.rere;
                    return (
                      <div key={target} className="mb-2" data-testid={`feedback-group-${target}`}>
                        <p className={`text-[11px] font-semibold mb-1 ${config.textClass}`}>{label}</p>
                        {items.map((item) => (
                          <div key={item.id} className="flex items-start gap-2 py-0.5" data-testid={`feedback-item-${item.id}`}>
                            <div className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${
                              item.sentiment === "positive" ? "bg-emerald-400" :
                              item.sentiment === "negative" ? "bg-red-400" :
                              item.sentiment === "mixed" ? "bg-amber-400" : "bg-muted-foreground/50"
                            }`} />
                            <p className="text-[13px] sm:text-xs leading-relaxed">{item.feedback}</p>
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-3 sm:px-4" ref={scrollRef} data-testid="container-messages">
        <div className="py-3 sm:py-4 space-y-3 max-w-2xl mx-auto">
          {historyLoading && (
            <div className="flex items-center justify-center py-16" data-testid="status-loading-history">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          )}

          {!historyLoading && messages.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 sm:py-16 text-center" data-testid="empty-state">
              <img src="/darvis-logo.png" alt="DARVIS" className="w-12 h-12 sm:w-14 sm:h-14 rounded-md object-cover mb-3 sm:mb-4" />
              <h2 className="text-base font-semibold mb-1" data-testid="text-greeting">DARVIS</h2>
              <p className="text-[13px] sm:text-sm text-muted-foreground max-w-[280px] sm:max-w-xs" data-testid="text-tagline">
                {isOwner
                  ? "Mirror Mode aktif. Ceritakan apa yang lagi lo pikirin, kita bedah bareng."
                  : isContributor
                  ? "Contributor Mode. Ceritakan pengalaman lo bareng DR — insight lo berharga buat DARVIS."
                  : "Framework berpikir untuk pengambilan keputusan. Ambil framework-nya, bukan figurnya."}
              </p>
              <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2 justify-center mt-5 sm:mt-6 w-full max-w-sm sm:max-w-none px-4 sm:px-0">
                {(isOwner
                  ? [
                      "Bantu gw pikirin keputusan ini",
                      "Sparring soal strategi dong",
                      "Gw butuh sudut pandang lain",
                    ]
                  : isContributor
                  ? [
                      "Gw mau cerita tentang DR",
                      "DR tuh orangnya kayak gini...",
                      "Menurut gw, DR itu...",
                    ]
                  : [
                      "Bantu saya pikirin keputusan ini",
                      "Saya butuh framework untuk strategi",
                      "Kasih perspektif dari sudut lain",
                    ]
                ).map((q, i) => (
                  <button
                    key={q}
                    onClick={() => {
                      setInput(q);
                      inputRef.current?.focus();
                    }}
                    className="px-3 py-2.5 sm:py-1.5 text-[13px] sm:text-xs rounded-md border bg-card text-foreground hover-elevate active-elevate-2 transition-colors text-left sm:text-center"
                    data-testid={`button-suggestion-${i}`}
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) =>
            msg.role === "user" ? (
              <UserBubble key={i} content={msg.content} index={i} images={msg.images} />
            ) : (
              <AssistantBubble key={i} content={msg.content} index={i} isOwner={isOwner} />
            ),
          )}

          {isStreaming && streamingContent && (
            <AssistantBubble content={streamingContent} index={messages.length} isOwner={isOwner} />
          )}
          {isStreaming && !streamingContent && <TypingIndicator />}
          {!isStreaming && currentContextMode && currentContextMode !== "general" && messages.length > 0 && messages[messages.length - 1]?.role === "assistant" && (
            <div className="flex justify-start pl-1" data-testid="container-context-mode">
              <ContextModeBadge mode={currentContextMode} />
            </div>
          )}
        </div>
      </div>

      <div className="border-t px-3 sm:px-4 py-2 sm:py-3 bg-background shrink-0 pb-[calc(0.5rem+env(safe-area-inset-bottom,0px))]" data-testid="container-input">
        {isListening && (
          <div className="max-w-2xl mx-auto mb-2 flex items-center gap-2 px-3 py-1.5 rounded-md bg-red-500/10 dark:bg-red-400/10" data-testid="status-voice-listening">
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse shrink-0" />
            <span className="text-xs text-red-600 dark:text-red-400">Mendengarkan... tekan mic lagi untuk berhenti</span>
          </div>
        )}
        {attachedImages.length > 0 && (
          <div className="max-w-2xl mx-auto mb-2 flex flex-wrap gap-2" data-testid="container-image-preview">
            {attachedImages.map((img, idx) => (
              <div key={idx} className="relative group" data-testid={`preview-image-${idx}`}>
                <img src={img} alt={`Preview ${idx + 1}`} className="h-16 w-16 sm:h-20 sm:w-20 object-cover rounded-md border" />
                <button
                  onClick={() => removeImage(idx)}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center text-xs"
                  data-testid={`button-remove-image-${idx}`}
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
            {attachedImages.length < 5 && (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="h-16 w-16 sm:h-20 sm:w-20 rounded-md border border-dashed flex items-center justify-center text-muted-foreground hover-elevate"
                data-testid="button-add-more-images"
              >
                <ImagePlus className="w-5 h-5" />
              </button>
            )}
          </div>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={handleFileSelect}
          data-testid="input-file-upload"
        />
        <div className="max-w-2xl mx-auto flex items-end gap-2">
          <Button
            onClick={() => fileInputRef.current?.click()}
            disabled={isStreaming || attachedImages.length >= 5}
            size="icon"
            variant="outline"
            data-testid="button-upload-image"
          >
            <ImagePlus className="w-4 h-4" />
          </Button>
          <Textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder={isListening ? "Bicara sekarang..." : attachedImages.length > 0 ? "Tulis pesan tentang gambar..." : "Ketik, paste gambar, atau tekan mic..."}
            rows={1}
            className="flex-1 resize-none min-h-[42px] max-h-[120px] text-[15px] sm:text-sm"
            onInput={(e) => {
              const target = e.target as HTMLTextAreaElement;
              target.style.height = "auto";
              target.style.height = Math.min(target.scrollHeight, 120) + "px";
            }}
            disabled={isStreaming}
            data-testid="input-message"
          />
          {voiceSupported && (
            <Button
              onClick={toggleVoice}
              disabled={isStreaming}
              size="icon"
              variant={isListening ? "destructive" : "outline"}
              data-testid="button-voice"
            >
              {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </Button>
          )}
          <Button
            onClick={handleSend}
            disabled={(!input.trim() && attachedImages.length === 0) || isStreaming}
            size="icon"
            data-testid="button-send"
          >
            {isStreaming ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
