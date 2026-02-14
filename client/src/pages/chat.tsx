import { useState, useRef, useEffect, useCallback } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Send, Trash2, Loader2, Lightbulb, X, Shield, Heart, Sparkles, User, Fingerprint, Mic, MicOff, ImagePlus, Lock, LogOut, Download, KeyRound, Users, Settings, Check, LayoutDashboard, Phone, PhoneOff, Volume2, FileText, FileSpreadsheet, File, Paperclip } from "lucide-react";
import { NotificationCenter } from "@/components/notification-center";
import { SecretaryDashboard } from "@/components/secretary-dashboard";
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

function AssistantBubble({ content, index, isOwner, onPlay, isTtsPlaying }: { content: string; index: number; isOwner: boolean; onPlay?: (text: string) => void; isTtsPlaying?: boolean }) {
  return (
    <Card className="p-2.5 sm:p-3 max-w-full sm:max-w-[85%] md:max-w-[75%] bg-card border-card-border group" data-testid={`bubble-assistant-${index}`}>
      <div data-testid={`text-assistant-${index}`}>
        <MarkdownContent content={content} />
      </div>
      {onPlay && (
        <div className="flex justify-end mt-1">
          <button
            onClick={() => onPlay(content)}
            className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity p-0.5"
            data-testid={`button-play-tts-${index}`}
            title="Dengarkan"
          >
            <Volume2 className={`w-3 h-3 ${isTtsPlaying ? "animate-pulse text-primary" : ""}`} />
          </button>
        </div>
      )}
    </Card>
  );
}

function UserBubble({ content, index, images }: { content: string; index: number; images?: string[] }) {
  return (
    <div className="flex justify-end" data-testid={`bubble-user-${index}`}>
      <div className="px-3 py-2 rounded-md bg-primary text-primary-foreground max-w-[90%] sm:max-w-[75%]">
        {images && images.length > 0 && (
          <div className={`flex flex-wrap gap-1.5 mb-2 ${images.length === 1 ? "" : images.length <= 4 ? "grid grid-cols-2" : "grid grid-cols-3"}`} data-testid={`images-user-${index}`}>
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
  cerita_bersama: "Cerita & Pengalaman Bersama",
  tokoh_idola: "Tokoh Idola & Inspirasi",
  film_favorit: "Film Favorit",
  prinsip_spiritual: "Spiritual & Religius",
  karakter_personal: "Karakter Personal",
  kebiasaan: "Kebiasaan",
  filosofi: "Filosofi Hidup",
  preferensi: "Preferensi & Selera",
  cara_bicara: "Gaya Komunikasi",
  relasi: "Relasi & Hubungan",
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

function parseSSELine(line: string): { type: string; content?: string; nodeUsed?: string | null; contextMode?: string | null; fullReply?: string; message?: string; retryable?: boolean } | null {
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
  const [showDashboard, setShowDashboard] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const [attachedImages, setAttachedImages] = useState<string[]>([]);
  const [attachedFile, setAttachedFile] = useState<{ name: string; type: string; content: string } | null>(null);
  const [fileUploading, setFileUploading] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [isContributor, setIsContributor] = useState(false);
  const [showLoginPanel, setShowLoginPanel] = useState(false);
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [showDownloadMenu, setShowDownloadMenu] = useState(false);
  const [conversationMode, setConversationMode] = useState(false);
  const [ttsVoice, setTtsVoice] = useState<string>("onyx");
  const [ttsPlaying, setTtsPlaying] = useState(false);
  const [showVoiceSelector, setShowVoiceSelector] = useState(false);
  const [showPasswordPanel, setShowPasswordPanel] = useState(false);
  const [pwType, setPwType] = useState<"owner" | "contributor">("owner");
  const [pwCurrent, setPwCurrent] = useState("");
  const [pwNew, setPwNew] = useState("");
  const [pwConfirm, setPwConfirm] = useState("");
  const [pwError, setPwError] = useState("");
  const [pwSuccess, setPwSuccess] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const downloadMenuRef = useRef<HTMLDivElement>(null);
  const voiceSelectorRef = useRef<HTMLDivElement>(null);
  const ttsAudioRef = useRef<HTMLAudioElement | null>(null);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const vadActiveRef = useRef(false);
  const pendingTtsRef = useRef<string | null>(null);
  const conversationModeRef = useRef(false);
  const vadSendRef = useRef<((text: string) => void) | null>(null);
  const lastHeardTextRef = useRef("");

  const focusInput = useCallback(() => {
    if (conversationModeRef.current) return;
    const doFocus = () => {
      try {
        if (inputRef.current && !conversationModeRef.current) {
          inputRef.current.focus({ preventScroll: true });
        }
      } catch {}
    };
    doFocus();
    setTimeout(doFocus, 50);
    setTimeout(doFocus, 200);
    setTimeout(doFocus, 500);
  }, []);

  useEffect(() => {
    focusInput();
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest("button") && !target.closest("input") && !target.closest("a") && !target.closest("[role='dialog']")) {
        focusInput();
      }
    };
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [focusInput]);

  useEffect(() => {
    if (!showLoginPanel && !showPrefs && !showPasswordPanel && !showDashboard) {
      focusInput();
    }
  }, [showLoginPanel, showPrefs, showPasswordPanel, showDashboard, focusInput]);

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

  useEffect(() => {
    if (!showVoiceSelector) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (voiceSelectorRef.current && !voiceSelectorRef.current.contains(e.target as Node)) {
        setShowVoiceSelector(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showVoiceSelector]);

  const { data: sessionData } = useQuery<{ isOwner: boolean; isContributor: boolean; mode: string; contributorTeamMemberId: number | null; contributorTeamMemberName: string | null }>({
    queryKey: ["/api/session-info"],
    refetchInterval: isContributor ? 5000 : false,
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

  const { data: contributorEnrichmentData } = useQuery<ProfileEnrichmentsResponse>({
    queryKey: ["/api/contributor-enrichments"],
    refetchInterval: 30000,
    enabled: isOwner,
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
    conversationModeRef.current = conversationMode;
  }, [conversationMode]);

  const unlockAudioRef = useRef(false);

  const unlockAudio = useCallback(() => {
    if (unlockAudioRef.current) return;
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const buf = ctx.createBuffer(1, 1, 22050);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(ctx.destination);
      src.start(0);
      ctx.resume();
      const silentAudio = new Audio("data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=");
      silentAudio.volume = 0.01;
      silentAudio.play().catch(() => {});
      unlockAudioRef.current = true;
    } catch {}
  }, []);

  const playTts = useCallback(async (text: string) => {
    try {
      if (ttsAudioRef.current) {
        ttsAudioRef.current.pause();
        if (ttsAudioRef.current.src && ttsAudioRef.current.src.startsWith("blob:")) {
          URL.revokeObjectURL(ttsAudioRef.current.src);
        }
        ttsAudioRef.current = null;
      }
      setTtsPlaying(true);

      const cleanText = text
        .replace(/#{1,6}\s/g, "")
        .replace(/\*\*([^*]+)\*\*/g, "$1")
        .replace(/\*([^*]+)\*/g, "$1")
        .replace(/`([^`]+)`/g, "$1")
        .replace(/```[\s\S]*?```/g, "")
        .replace(/>\s/g, "")
        .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
        .replace(/[-*+]\s/g, "")
        .replace(/\d+\.\s/g, "")
        .trim();

      if (!cleanText) { setTtsPlaying(false); return; }

      const ttsText = conversationModeRef.current && cleanText.length > 500
        ? cleanText.slice(0, 500)
        : cleanText;

      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: ttsText, voice: ttsVoice }),
        credentials: "include",
      });

      if (!res.ok) { setTtsPlaying(false); return; }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.volume = 1.0;
      ttsAudioRef.current = audio;

      audio.onended = () => {
        setTtsPlaying(false);
        URL.revokeObjectURL(url);
        ttsAudioRef.current = null;
        if (conversationModeRef.current && recognitionRef.current) {
          try {
            setInput("");
            recognitionRef.current.start();
            setIsListening(true);
          } catch {}
        }
      };

      audio.onerror = () => {
        setTtsPlaying(false);
        URL.revokeObjectURL(url);
        ttsAudioRef.current = null;
        if (conversationModeRef.current && recognitionRef.current) {
          try {
            setInput("");
            recognitionRef.current.start();
            setIsListening(true);
          } catch {}
        }
      };

      try {
        await audio.play();
      } catch {
        setTtsPlaying(false);
        URL.revokeObjectURL(url);
        ttsAudioRef.current = null;
        if (conversationModeRef.current && recognitionRef.current) {
          try {
            setInput("");
            recognitionRef.current.start();
            setIsListening(true);
          } catch {}
        }
      }
    } catch {
      setTtsPlaying(false);
    }
  }, [ttsVoice]);

  const stopTts = useCallback(() => {
    if (ttsAudioRef.current) {
      const src = ttsAudioRef.current.src;
      ttsAudioRef.current.pause();
      ttsAudioRef.current.currentTime = 0;
      ttsAudioRef.current = null;
      if (src.startsWith("blob:")) URL.revokeObjectURL(src);
    }
    setTtsPlaying(false);
  }, []);

  const spokenTextRef = useRef("");
  const isListeningRef = useRef(false);
  const sentInSessionRef = useRef(false);

  useEffect(() => {
    isListeningRef.current = isListening;
  }, [isListening]);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      setVoiceSupported(true);
      const recognition = new SpeechRecognition();
      recognition.lang = "id-ID";
      recognition.continuous = false;
      recognition.interimResults = true;

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        let interimTranscript = "";
        let finalTranscript = "";
        for (let i = 0; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript;
          } else {
            interimTranscript += transcript;
          }
        }

        if (conversationModeRef.current) {
          const display = finalTranscript || interimTranscript;
          setInput(display.trim());
          if (finalTranscript) {
            const textToSend = finalTranscript.trim();
            if (textToSend && vadSendRef.current && !sentInSessionRef.current) {
              sentInSessionRef.current = true;
              lastHeardTextRef.current = "";
              vadSendRef.current(textToSend);
              spokenTextRef.current = "";
            }
          } else {
            lastHeardTextRef.current = display.trim();
          }
        } else {
          if (finalTranscript) {
            spokenTextRef.current = (spokenTextRef.current + " " + finalTranscript).trim();
            setInput(spokenTextRef.current);
            lastHeardTextRef.current = "";
          } else {
            const display = (spokenTextRef.current + " " + interimTranscript).trim();
            setInput(display);
          }
        }
      };

      recognition.onend = () => {
        sentInSessionRef.current = false;
        if (conversationModeRef.current) {
          const heardText = lastHeardTextRef.current.trim();
          lastHeardTextRef.current = "";
          if (heardText && vadSendRef.current) {
            vadSendRef.current(heardText);
            spokenTextRef.current = "";
            setIsListening(false);
          } else if (isListeningRef.current) {
            setTimeout(() => {
              if (conversationModeRef.current && recognitionRef.current) {
                try {
                  recognitionRef.current.start();
                } catch {}
              } else {
                setIsListening(false);
              }
            }, 100);
          }
        } else if (isListeningRef.current) {
          setTimeout(() => {
            if (isListeningRef.current && recognitionRef.current && !conversationModeRef.current) {
              try {
                recognitionRef.current.start();
              } catch {
                setIsListening(false);
              }
            }
          }, 100);
        }
      };

      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        if (event.error === "aborted") return;
        if (event.error === "no-speech") {
          if ((conversationModeRef.current || isListeningRef.current) && recognitionRef.current) {
            setTimeout(() => {
              if (recognitionRef.current && (conversationModeRef.current || isListeningRef.current)) {
                try { recognitionRef.current.start(); } catch {}
              }
            }, 200);
          }
          return;
        }
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    }

    return () => {
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch {}
      }
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
      }
      if (ttsAudioRef.current) {
        ttsAudioRef.current.pause();
        ttsAudioRef.current = null;
      }
    };
  }, []);

  const toggleVoice = useCallback(() => {
    if (!recognitionRef.current) return;
    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
      spokenTextRef.current = "";
    } else {
      setInput("");
      spokenTextRef.current = "";
      lastHeardTextRef.current = "";
      recognitionRef.current.start();
      setIsListening(true);
    }
  }, [isListening]);

  const toggleConversationMode = useCallback(() => {
    if (conversationMode) {
      setConversationMode(false);
      if (isListening && recognitionRef.current) {
        recognitionRef.current.stop();
        setIsListening(false);
      }
      stopTts();
      spokenTextRef.current = "";
      lastHeardTextRef.current = "";
    } else {
      unlockAudio();
      setConversationMode(true);
      spokenTextRef.current = "";
      lastHeardTextRef.current = "";
      setInput("");
      if (recognitionRef.current && !isListening) {
        try {
          recognitionRef.current.start();
          setIsListening(true);
        } catch {}
      }
    }
  }, [conversationMode, isListening, stopTts, unlockAudio]);

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

  const handleChangePassword = useCallback(async () => {
    setPwError("");
    setPwSuccess("");
    if (!pwNew || pwNew.length < 4) {
      setPwError("Password baru minimal 4 karakter");
      return;
    }
    if (pwNew !== pwConfirm) {
      setPwError("Konfirmasi password tidak cocok");
      return;
    }
    try {
      const res = await fetch("/api/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ type: pwType, currentPassword: pwCurrent, newPassword: pwNew }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setPwSuccess(data.message);
        setPwCurrent("");
        setPwNew("");
        setPwConfirm("");
      } else {
        setPwError(data.message || "Gagal mengubah password");
      }
    } catch {
      setPwError("Gagal koneksi ke server");
    }
  }, [pwType, pwCurrent, pwNew, pwConfirm]);

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

  const sendMessage = useCallback(async (payload: { message: string; images?: string[] }, retryCount = 0) => {
    setIsStreaming(true);
    if (retryCount === 0) setStreamingContent("");
    const MAX_RETRIES = 2;

    let fetchTimeout: ReturnType<typeof setTimeout> | null = null;
    let staleCheck: ReturnType<typeof setInterval> | null = null;
    let controller: AbortController | null = null;

    const cleanup = () => {
      if (fetchTimeout) { clearTimeout(fetchTimeout); fetchTimeout = null; }
      if (staleCheck) { clearInterval(staleCheck); staleCheck = null; }
    };

    try {
      controller = new AbortController();
      fetchTimeout = setTimeout(() => controller?.abort(), 90000);

      const chatPayload = conversationModeRef.current
        ? { ...payload, voiceMode: true }
        : payload;

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(chatPayload),
        credentials: "include",
        signal: controller.signal,
      });

      if (fetchTimeout) { clearTimeout(fetchTimeout); fetchTimeout = null; }

      if (!response.ok || !response.body) {
        throw new Error("Stream request failed");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let accumulated = "";
      let lastChunkTime = Date.now();
      let gotData = false;

      staleCheck = setInterval(() => {
        if (Date.now() - lastChunkTime > 45000 && !gotData) {
          reader.cancel();
          cleanup();
        }
      }, 5000);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        lastChunkTime = Date.now();
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const parsed = parseSSELine(line);
          if (!parsed) continue;

          if (parsed.type === "heartbeat") {
            lastChunkTime = Date.now();
            continue;
          }

          if (parsed.type === "chunk" && parsed.content) {
            gotData = true;
            accumulated += parsed.content;
            setStreamingContent(accumulated);
          } else if (parsed.type === "done") {
            gotData = true;
            const finalContent = parsed.fullReply || accumulated;
            setMessages((prev) => [...prev, { role: "assistant", content: finalContent }]);
            setStreamingContent("");
            if (parsed.contextMode) setCurrentContextMode(parsed.contextMode);
            else setCurrentContextMode(null);
            if (conversationModeRef.current && finalContent) {
              pendingTtsRef.current = finalContent;
            }
          } else if (parsed.type === "error") {
            cleanup();
            const canRetry = parsed.retryable !== false;
            if (canRetry && retryCount < MAX_RETRIES && !gotData) {
              controller?.abort();
              setStreamingContent("Mencoba ulang...");
              await new Promise(r => setTimeout(r, 2000));
              return sendMessage(payload, retryCount + 1);
            }
            setMessages((prev) => [...prev, {
              role: "assistant",
              content: parsed.message || "Koneksi terputus. Coba lagi ya.",
            }]);
            setStreamingContent("");
          }
        }
      }
      cleanup();

      if (!gotData && retryCount < MAX_RETRIES) {
        setStreamingContent("Mencoba ulang...");
        await new Promise(r => setTimeout(r, 2000));
        return sendMessage(payload, retryCount + 1);
      }
    } catch (err: unknown) {
      cleanup();
      const isAbort = err instanceof DOMException && err.name === "AbortError";
      if (retryCount < MAX_RETRIES) {
        controller?.abort();
        setStreamingContent("Mencoba ulang...");
        await new Promise(r => setTimeout(r, 2000));
        return sendMessage(payload, retryCount + 1);
      }
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: isAbort
            ? "Respons terlalu lama. Coba kirim ulang dengan pertanyaan yang lebih singkat."
            : "Maaf, ada gangguan teknis. Coba ulangi ya.",
        },
      ]);
      setStreamingContent("");
    } finally {
      setIsStreaming(false);
      if (!conversationModeRef.current) {
        setTimeout(() => inputRef.current?.focus(), 50);
        setTimeout(() => inputRef.current?.focus(), 200);
        setTimeout(() => inputRef.current?.focus(), 500);
      }
      setTimeout(scrollToBottom, 50);
      if (pendingTtsRef.current) {
        const ttsText = pendingTtsRef.current;
        pendingTtsRef.current = null;
        playTts(ttsText);
      }
    }
  }, [scrollToBottom, playTts]);

  useEffect(() => {
    vadSendRef.current = (text: string) => {
      if (!text.trim() || isStreaming) return;
      const userMsg: ChatMessage = { role: "user", content: text };
      setMessages((prev) => [...prev, userMsg]);
      setInput("");
      lastHeardTextRef.current = "";
      sendMessage({ message: text });
    };
  }, [sendMessage, isStreaming]);

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
    const maxTotal = 10;
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

  const DOCUMENT_EXTENSIONS = [".pdf", ".docx", ".xlsx", ".xls", ".txt", ".md", ".csv"];
  const isDocumentFile = (file: File) => {
    const ext = "." + file.name.split(".").pop()?.toLowerCase();
    return DOCUMENT_EXTENSIONS.includes(ext);
  };

  const uploadDocumentFile = useCallback(async (file: File) => {
    setFileUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const resp = await fetch("/api/upload-file", { method: "POST", body: formData, credentials: "include" });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.message || "Upload gagal");
      setAttachedFile({ name: data.fileName, type: data.fileType, content: data.content });
    } catch (err: any) {
      alert(err.message || "Gagal upload file");
    } finally {
      setFileUploading(false);
    }
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const fileArr = Array.from(files);
    const imageFiles = fileArr.filter((f) => f.type.startsWith("image/"));
    const docFiles = fileArr.filter((f) => isDocumentFile(f));
    const unsupported = fileArr.filter((f) => !f.type.startsWith("image/") && !isDocumentFile(f));
    if (unsupported.length > 0) {
      alert(`${unsupported.length} file tidak didukung. Gunakan gambar, PDF, Word, Excel, TXT, MD, atau CSV.`);
    }
    if (imageFiles.length > 0) {
      addImages(imageFiles);
    }
    if (docFiles.length > 0) {
      uploadDocumentFile(docFiles[0]);
    }
    e.target.value = "";
  }, [addImages, uploadDocumentFile]);

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
    const hasContent = trimmed || attachedImages.length > 0 || attachedFile;
    if (!hasContent || isStreaming || fileUploading) return;

    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
    }

    let msgText = trimmed;
    if (attachedFile) {
      const filePrefix = `[File: ${attachedFile.name} (${attachedFile.type})]\n\n${attachedFile.content}\n\n---\n\n`;
      msgText = filePrefix + (trimmed || "Tolong analisa isi file ini");
    } else if (!trimmed && attachedImages.length > 0) {
      msgText = "Tolong analisa gambar ini";
    }

    const currentImages = attachedImages.length > 0 ? [...attachedImages] : undefined;
    const displayText = attachedFile ? (trimmed || "Tolong analisa isi file ini") + `\n📎 ${attachedFile.name}` : msgText;
    const userMsg: ChatMessage = { role: "user", content: displayText, images: currentImages };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setAttachedImages([]);
    const currentFile = attachedFile;
    setAttachedFile(null);

    sendMessage({ message: msgText, images: currentImages });
    focusInput();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-[100dvh] bg-background" data-testid="page-chat">
      <header className="flex items-center justify-between gap-2 px-3 sm:px-4 py-2 sm:py-3 border-b shrink-0 pt-[calc(0.5rem+env(safe-area-inset-top,0px))] sm:pt-2" data-testid="header-darvis">
        <div className="flex items-center gap-2" data-testid="header-brand">
          <img src="/darvis-logo.png" alt="DARVIS" className="w-7 h-7 sm:w-8 sm:h-8 rounded-md object-cover" />
          <div>
            <h1 className="text-sm font-bold tracking-tight leading-none" data-testid="text-app-title">DARVIS</h1>
            <p className="text-[10px] text-muted-foreground leading-tight mt-0.5" data-testid="text-app-version">
              {isOwner ? "Mirror Mode" : isContributor ? (sessionData?.contributorTeamMemberName ? `Hi, ${sessionData.contributorTeamMemberName}` : "Contributor Mode") : "Thinking Companion"} v2.0
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
            <>
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
                onClick={() => { setShowPasswordPanel(!showPasswordPanel); setPwError(""); setPwSuccess(""); setPwCurrent(""); setPwNew(""); setPwConfirm(""); }}
                className={`toggle-elevate ${showPasswordPanel ? "toggle-elevated" : ""}`}
                data-testid="button-show-settings"
                title="Pengaturan"
              >
                <Settings className="w-4 h-4" />
              </Button>
              <NotificationCenter />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowDashboard(!showDashboard)}
                className={`toggle-elevate ${showDashboard ? "toggle-elevated" : ""}`}
                data-testid="button-show-dashboard"
                title="Dashboard Secretary"
              >
                <LayoutDashboard className="w-4 h-4" />
              </Button>
            </>
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

              <div className="mt-4 pt-3 border-t" data-testid="container-contributor-enrichments">
                <div className="flex items-center gap-2 mb-2">
                  <Users className="w-3.5 h-3.5 text-amber-500" />
                  <h4 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Insight dari Contributor</h4>
                </div>
                {(!contributorEnrichmentData?.enrichments || contributorEnrichmentData.enrichments.length === 0) ? (
                  <p className="text-xs text-muted-foreground py-1" data-testid="text-contributor-empty">
                    Belum ada insight dari contributor. Bagikan password contributor ke orang yang kenal DR untuk mulai mengumpulkan cerita.
                  </p>
                ) : (
                  Object.entries(
                    contributorEnrichmentData.enrichments.reduce<Record<string, typeof contributorEnrichmentData.enrichments>>((acc, e) => {
                      if (!acc[e.category]) acc[e.category] = [];
                      acc[e.category].push(e);
                      return acc;
                    }, {})
                  ).map(([category, items]) => (
                    <div key={category} className="mb-2" data-testid={`contributor-enrichment-group-${category}`}>
                      <p className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 mb-1">
                        {ENRICHMENT_LABELS[category] || category}
                      </p>
                      {items.map((item) => (
                        <div key={item.id} className="flex items-start gap-2 py-0.5" data-testid={`contributor-enrichment-item-${item.id}`}>
                          <div className="w-1.5 h-1.5 rounded-full bg-amber-400/60 mt-1.5 shrink-0" />
                          <p className="text-[13px] sm:text-xs leading-relaxed">{item.fact}</p>
                        </div>
                      ))}
                    </div>
                  ))
                )}
              </div>

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

      {showPasswordPanel && isOwner && (
        <div className="fixed inset-0 z-50 sm:relative sm:inset-auto sm:z-auto flex flex-col bg-background sm:bg-card/50 sm:border-b sm:max-h-[50vh] pt-[env(safe-area-inset-top,0px)] sm:pt-0" data-testid="panel-settings">
          <div className="flex items-center justify-between gap-2 px-4 py-3 border-b sm:border-b-0 shrink-0">
            <div className="flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-semibold" data-testid="text-settings-title">Ubah Password</h3>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setShowPasswordPanel(false)} data-testid="button-close-settings">
              <X className="w-4 h-4" />
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto px-4 pb-4 sm:pb-3">
            <div className="max-w-sm mx-auto space-y-4">
              <div className="flex gap-2">
                <Button
                  variant={pwType === "owner" ? "default" : "outline"}
                  size="sm"
                  onClick={() => { setPwType("owner"); setPwError(""); setPwSuccess(""); setPwCurrent(""); setPwNew(""); setPwConfirm(""); }}
                  data-testid="button-pw-type-owner"
                >
                  Password Owner
                </Button>
                <Button
                  variant={pwType === "contributor" ? "default" : "outline"}
                  size="sm"
                  onClick={() => { setPwType("contributor"); setPwError(""); setPwSuccess(""); setPwCurrent(""); setPwNew(""); setPwConfirm(""); }}
                  data-testid="button-pw-type-contributor"
                >
                  Password Contributor
                </Button>
              </div>
              {pwType === "owner" && (
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Password lama</label>
                  <Input
                    type="password"
                    value={pwCurrent}
                    onChange={(e) => setPwCurrent(e.target.value)}
                    placeholder="Masukkan password lama"
                    data-testid="input-pw-current"
                  />
                </div>
              )}
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Password baru</label>
                <Input
                  type="password"
                  value={pwNew}
                  onChange={(e) => setPwNew(e.target.value)}
                  placeholder="Minimal 4 karakter"
                  data-testid="input-pw-new"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Konfirmasi password baru</label>
                <Input
                  type="password"
                  value={pwConfirm}
                  onChange={(e) => setPwConfirm(e.target.value)}
                  placeholder="Ulangi password baru"
                  data-testid="input-pw-confirm"
                />
              </div>
              {pwError && <p className="text-xs text-destructive" data-testid="text-pw-error">{pwError}</p>}
              {pwSuccess && (
                <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400" data-testid="text-pw-success">
                  <Check className="w-3.5 h-3.5" />
                  <span>{pwSuccess}</span>
                </div>
              )}
              <Button onClick={handleChangePassword} size="sm" data-testid="button-submit-pw">
                Simpan Password
              </Button>
            </div>
          </div>
        </div>
      )}

      {showDashboard && isOwner && (
        <SecretaryDashboard onClose={() => setShowDashboard(false)} />
      )}

      <div className={`flex-1 overflow-y-auto px-3 sm:px-4 ${showDashboard ? "hidden" : ""}`} ref={scrollRef} data-testid="container-messages">
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
                  ? "Yo, mau ngobrolin apa nih? Gw siap sparring."
                  : isContributor
                  ? sessionData?.contributorTeamMemberName
                    ? `Halo ${sessionData.contributorTeamMemberName}! Yuk ngobrol — ceritain tentang lo dan kerjaan lo.`
                    : "Contributor Mode. Sebutin nama lo dulu biar DARVIS kenal, atau langsung cerita tentang DR."
                  : "Tony Stark punya JARVIS, lu punya DARVIS. Partner diskusi lu."}
              </p>
              <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2 justify-center mt-5 sm:mt-6 w-full max-w-sm sm:max-w-none px-4 sm:px-0">
                {(isOwner
                  ? [
                      "Bantu gw pikirin keputusan ini",
                      "Sparring soal strategi dong",
                      "Gw butuh sudut pandang lain",
                    ]
                  : isContributor
                  ? sessionData?.contributorTeamMemberName
                    ? [
                        "Gw ceritain soal kerjaan gw",
                        "Gaya kerja gw tuh kayak gini...",
                        "Yang bikin gw kesel di kerjaan...",
                      ]
                    : [
                        "Gw mau cerita tentang DR",
                        "DR tuh orangnya kayak gini...",
                        "Menurut gw, DR itu...",
                      ]
                  : [
                      "Bantu gw pikirin keputusan ini",
                      "Gw butuh strategi nih",
                      "Kasih sudut pandang lain dong",
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
              <AssistantBubble key={i} content={msg.content} index={i} isOwner={isOwner} onPlay={(text) => { unlockAudio(); playTts(text); }} isTtsPlaying={ttsPlaying} />
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

      <div className={`border-t px-3 sm:px-4 py-2 sm:py-3 bg-background shrink-0 pb-[calc(0.5rem+env(safe-area-inset-bottom,0px))] ${showDashboard ? "hidden" : ""}`} data-testid="container-input">
        {conversationMode && (
          <div className="max-w-2xl mx-auto mb-2 flex items-center gap-2 px-3 py-1.5 rounded-md bg-primary/10 dark:bg-primary/20" data-testid="status-conversation-mode">
            <Phone className="w-3.5 h-3.5 text-primary shrink-0" />
            <span className="text-xs text-primary flex-1">
              {ttsPlaying ? "DARVIS sedang bicara..." : isStreaming ? "DARVIS sedang mikir..." : isListening ? "Mendengarkan... diam 2.5 detik untuk kirim otomatis" : "Mode Percakapan aktif"}
            </span>
            {ttsPlaying && (
              <Button size="icon" variant="ghost" onClick={stopTts} className="h-6 w-6" data-testid="button-stop-tts">
                <Volume2 className="w-3.5 h-3.5 animate-pulse" />
              </Button>
            )}
            <div className="relative" ref={voiceSelectorRef}>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => setShowVoiceSelector(!showVoiceSelector)}
                className="h-6 w-6"
                data-testid="button-voice-selector"
                title="Pilih suara"
              >
                <Settings className="w-3 h-3" />
              </Button>
              {showVoiceSelector && (
                <div className="absolute bottom-full right-0 mb-1 w-40 bg-popover border rounded-md shadow-md p-1 z-50" data-testid="container-voice-selector">
                  {[
                    { id: "onyx", label: "Onyx", desc: "Berat, maskulin" },
                    { id: "echo", label: "Echo", desc: "Lembut, maskulin" },
                    { id: "ash", label: "Ash", desc: "Hangat, maskulin" },
                    { id: "nova", label: "Nova", desc: "Cerah, feminin" },
                    { id: "shimmer", label: "Shimmer", desc: "Halus, feminin" },
                    { id: "coral", label: "Coral", desc: "Santai, feminin" },
                    { id: "alloy", label: "Alloy", desc: "Netral" },
                    { id: "fable", label: "Fable", desc: "Ekspresif" },
                    { id: "sage", label: "Sage", desc: "Bijak, tenang" },
                  ].map((v) => (
                    <button
                      key={v.id}
                      onClick={() => { setTtsVoice(v.id); setShowVoiceSelector(false); }}
                      className={`w-full text-left px-2 py-1 rounded-sm text-xs flex items-center justify-between gap-1 hover-elevate ${ttsVoice === v.id ? "bg-primary/10 text-primary" : ""}`}
                      data-testid={`button-voice-option-${v.id}`}
                    >
                      <span className="font-medium">{v.label}</span>
                      <span className="text-muted-foreground text-[10px]">{v.desc}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
        {!conversationMode && isListening && (
          <div className="max-w-2xl mx-auto mb-2 flex items-center gap-2 px-3 py-1.5 rounded-md bg-red-500/10 dark:bg-red-400/10" data-testid="status-voice-listening">
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse shrink-0" />
            <span className="text-xs text-red-600 dark:text-red-400">Mendengarkan... tekan mic lagi untuk berhenti</span>
          </div>
        )}
        {(attachedImages.length > 0 || attachedFile || fileUploading) && (
          <div className="max-w-2xl mx-auto mb-2 flex flex-wrap gap-2 items-center" data-testid="container-attachment-preview">
            {attachedImages.length > 1 && (
              <span className="text-[10px] text-muted-foreground w-full" data-testid="text-image-count">{attachedImages.length}/10 gambar</span>
            )}
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
            {fileUploading && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-md border bg-muted/50" data-testid="file-uploading">
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Memproses file...</span>
              </div>
            )}
            {attachedFile && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-md border bg-muted/50 relative" data-testid="preview-file">
                {attachedFile.type === "PDF" && <FileText className="w-4 h-4 text-red-500 shrink-0" />}
                {attachedFile.type === "Word" && <FileText className="w-4 h-4 text-blue-500 shrink-0" />}
                {(attachedFile.type === "Excel" || attachedFile.type === "CSV") && <FileSpreadsheet className="w-4 h-4 text-green-500 shrink-0" />}
                {(attachedFile.type === "Text" || attachedFile.type === "Markdown") && <File className="w-4 h-4 text-muted-foreground shrink-0" />}
                <span className="text-xs truncate max-w-[200px]">{attachedFile.name}</span>
                <button
                  onClick={() => setAttachedFile(null)}
                  className="w-4 h-4 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center text-xs shrink-0"
                  data-testid="button-remove-file"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,.pdf,.docx,.xlsx,.xls,.txt,.md,.csv"
          multiple
          className="hidden"
          onChange={handleFileSelect}
          data-testid="input-file-upload"
        />
        {conversationMode ? (
          <div className="max-w-2xl mx-auto flex flex-col items-center gap-3 py-2">
            <div className="flex items-center gap-3">
              <Button
                onClick={toggleConversationMode}
                size="icon"
                variant="destructive"
                data-testid="button-end-conversation"
                title="Akhiri percakapan"
              >
                <PhoneOff className="w-4 h-4" />
              </Button>
              {isListening && (
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                  <div className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" style={{ animationDelay: "0.2s" }} />
                  <div className="w-1 h-1 rounded-full bg-red-300 animate-pulse" style={{ animationDelay: "0.4s" }} />
                </div>
              )}
            </div>
            {input && (
              <p className="text-xs text-muted-foreground italic max-w-xs text-center truncate" data-testid="text-voice-preview">
                "{input}"
              </p>
            )}
          </div>
        ) : (
          <div className="max-w-2xl mx-auto flex items-end gap-2">
            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={isStreaming || fileUploading || (attachedImages.length >= 10 && !!attachedFile)}
              size="icon"
              variant="outline"
              data-testid="button-upload-file"
            >
              <Paperclip className="w-4 h-4" />
            </Button>
            <Textarea
              ref={inputRef}
              autoFocus
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              placeholder={isListening ? "Ngomong aja..." : attachedFile ? `Tulis instruksi untuk ${attachedFile.name}...` : attachedImages.length > 0 ? `Ceritain soal ${attachedImages.length} gambar...` : "Mau ngobrolin apa nih..."}
              rows={1}
              style={{ fontSize: "16px" }}
              className="flex-1 resize-none min-h-[42px] max-h-[120px]"
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement;
                target.style.height = "auto";
                target.style.height = Math.min(target.scrollHeight, 120) + "px";
              }}
              disabled={isStreaming}
              data-testid="input-message"
            />
            {voiceSupported && (
              <>
                <Button
                  onClick={toggleVoice}
                  disabled={isStreaming}
                  size="icon"
                  variant={isListening ? "destructive" : "outline"}
                  data-testid="button-voice"
                >
                  {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                </Button>
                {/* Voice conversation mode hidden for now */}
              </>
            )}
            <Button
              onClick={handleSend}
              disabled={(!input.trim() && attachedImages.length === 0 && !attachedFile) || isStreaming || fileUploading}
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
        )}
      </div>
    </div>
  );
}
