import { useState, useRef, useEffect, useCallback } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Send, Trash2, Loader2, Lightbulb, X, Shield, Heart, Sparkles, User, Fingerprint, Mic, MicOff, ImagePlus } from "lucide-react";
import type { ChatMessage, ChatResponse, HistoryResponse, PreferencesResponse, PersonaFeedbackResponse, ProfileEnrichmentsResponse } from "@shared/schema";

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
        <p className="text-[13px] sm:text-sm leading-relaxed whitespace-pre-wrap" data-testid={`text-${persona}-${index}`}>{content}</p>
      </Card>
    </div>
  );
}

function AssistantBubble({ content, index }: { content: string; index: number }) {
  const parsed = parseQuadVoice(content);

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
      <p className="text-[13px] sm:text-sm leading-relaxed whitespace-pre-wrap" data-testid={`text-assistant-${index}`}>{content}</p>
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

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [showPrefs, setShowPrefs] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const [attachedImages, setAttachedImages] = useState<string[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

      let finalTranscript = "";

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        let interim = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript + " ";
          } else {
            interim = transcript;
          }
        }
        setInput((finalTranscript + interim).trim());
      };

      recognition.onend = () => {
        setIsListening(false);
        finalTranscript = "";
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

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const chatMutation = useMutation({
    mutationFn: async (payload: { message: string; images?: string[] }) => {
      const res = await apiRequest("POST", "/api/chat", payload);
      return (await res.json()) as ChatResponse;
    },
    onSuccess: (data) => {
      setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
    },
    onError: () => {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Maaf, ada gangguan teknis. Coba ulangi ya — kadang koneksi memang perlu waktu.",
        },
      ]);
    },
    onSettled: () => {
      inputRef.current?.focus();
      setTimeout(scrollToBottom, 50);
    },
  });

  useEffect(() => {
    if (chatMutation.isPending) {
      scrollToBottom();
    }
  }, [chatMutation.isPending, scrollToBottom]);

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

  const handleSend = () => {
    const trimmed = input.trim();
    const hasContent = trimmed || attachedImages.length > 0;
    if (!hasContent || chatMutation.isPending) return;

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

    chatMutation.mutate({ message: msgText, images: currentImages });
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
            <p className="text-[10px] text-muted-foreground leading-tight mt-0.5" data-testid="text-app-version">Thinking Companion v0.3</p>
          </div>
        </div>
        <div className="flex items-center gap-0.5 sm:gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowPrefs(!showPrefs)}
            className={`toggle-elevate ${showPrefs ? "toggle-elevated" : ""}`}
            data-testid="button-show-preferences"
          >
            <Lightbulb className="w-4 h-4" />
          </Button>
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

      {showPrefs && (
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
                Thinking companion. Ceritakan apa yang lagi lo pikirin, kita bedah bareng.
              </p>
              <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2 justify-center mt-5 sm:mt-6 w-full max-w-sm sm:max-w-none px-4 sm:px-0">
                {[
                  "Bantu gw pikirin keputusan ini",
                  "Sparring soal strategi dong",
                  "Gw butuh sudut pandang lain",
                ].map((q, i) => (
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
              <AssistantBubble key={i} content={msg.content} index={i} />
            ),
          )}

          {chatMutation.isPending && <TypingIndicator />}
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
            disabled={chatMutation.isPending || attachedImages.length >= 5}
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
            disabled={chatMutation.isPending}
            data-testid="input-message"
          />
          {voiceSupported && (
            <Button
              onClick={toggleVoice}
              disabled={chatMutation.isPending}
              size="icon"
              variant={isListening ? "destructive" : "outline"}
              data-testid="button-voice"
            >
              {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </Button>
          )}
          <Button
            onClick={handleSend}
            disabled={(!input.trim() && attachedImages.length === 0) || chatMutation.isPending}
            size="icon"
            data-testid="button-send"
          >
            {chatMutation.isPending ? (
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
