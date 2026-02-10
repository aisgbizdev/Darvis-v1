import { useState, useRef, useEffect, useCallback } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Send, Trash2, Loader2, Brain, Lightbulb, X } from "lucide-react";
import type { ChatMessage, ChatResponse, HistoryResponse, PreferencesResponse } from "@shared/schema";

function parseDualVoice(text: string) {
  const brotoMatch = text.match(/Broto:\s*([\s\S]*?)(?=\n\s*Rara:|$)/i);
  const raraMatch = text.match(/Rara:\s*([\s\S]*?)$/i);

  if (brotoMatch && raraMatch) {
    return {
      broto: brotoMatch[1].trim(),
      rara: raraMatch[1].trim(),
    };
  }
  return null;
}

function AssistantBubble({ content, index }: { content: string; index: number }) {
  const parsed = parseDualVoice(content);

  if (parsed) {
    return (
      <div className="flex flex-col gap-2 max-w-[85%] sm:max-w-[75%]" data-testid={`bubble-assistant-${index}`}>
        <Card className="p-3 bg-card border-card-border">
          <div className="flex items-center gap-2 mb-1.5">
            <div className="w-5 h-5 rounded-md bg-primary/15 flex items-center justify-center" data-testid={`icon-broto-${index}`}>
              <span className="text-[10px] font-bold text-primary">B</span>
            </div>
            <span className="text-xs font-semibold text-muted-foreground" data-testid={`label-broto-${index}`}>Broto</span>
          </div>
          <p className="text-sm leading-relaxed whitespace-pre-wrap" data-testid={`text-broto-${index}`}>{parsed.broto}</p>
        </Card>
        <Card className="p-3 bg-card border-card-border">
          <div className="flex items-center gap-2 mb-1.5">
            <div className="w-5 h-5 rounded-md bg-chart-3/15 flex items-center justify-center" data-testid={`icon-rara-${index}`}>
              <span className="text-[10px] font-bold text-chart-3">R</span>
            </div>
            <span className="text-xs font-semibold text-muted-foreground" data-testid={`label-rara-${index}`}>Rara</span>
          </div>
          <p className="text-sm leading-relaxed whitespace-pre-wrap" data-testid={`text-rara-${index}`}>{parsed.rara}</p>
        </Card>
      </div>
    );
  }

  return (
    <Card className="p-3 max-w-[85%] sm:max-w-[75%] bg-card border-card-border" data-testid={`bubble-assistant-${index}`}>
      <p className="text-sm leading-relaxed whitespace-pre-wrap" data-testid={`text-assistant-${index}`}>{content}</p>
    </Card>
  );
}

function UserBubble({ content, index }: { content: string; index: number }) {
  return (
    <div className="flex justify-end" data-testid={`bubble-user-${index}`}>
      <div className="px-3 py-2 rounded-md bg-primary text-primary-foreground max-w-[85%] sm:max-w-[75%]">
        <p className="text-sm leading-relaxed whitespace-pre-wrap" data-testid={`text-user-${index}`}>{content}</p>
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex items-center gap-2 max-w-[85%] sm:max-w-[75%]" data-testid="status-typing">
      <Card className="p-3 bg-card border-card-border">
        <div className="flex items-center gap-2">
          <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
          <span className="text-xs text-muted-foreground" data-testid="text-typing-status">DARVIS sedang berpikir...</span>
        </div>
      </Card>
    </div>
  );
}

const CATEGORY_LABELS: Record<string, string> = {
  gaya_berpikir: "Gaya Berpikir",
  preferensi_komunikasi: "Preferensi Komunikasi",
  konteks_bisnis: "Konteks Bisnis",
  pola_keputusan: "Pola Keputusan",
  area_fokus: "Area Fokus",
  koreksi_penting: "Koreksi Penting",
};

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [showPrefs, setShowPrefs] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const { data: historyData, isLoading: historyLoading } = useQuery<HistoryResponse>({
    queryKey: ["/api/history"],
  });

  const { data: prefsData } = useQuery<PreferencesResponse>({
    queryKey: ["/api/preferences"],
    refetchInterval: 30000,
  });

  useEffect(() => {
    if (historyData?.messages) {
      setMessages(historyData.messages);
    }
  }, [historyData]);

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const chatMutation = useMutation({
    mutationFn: async (payload: { message: string }) => {
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
          content: `Broto: Maaf mas DR, terjadi gangguan teknis. Silakan coba lagi.\n\nRara: Tenang mas DR, kadang koneksi memang perlu waktu. Coba ulangi ya.`,
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
      inputRef.current?.focus();
    },
  });

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed || chatMutation.isPending) return;

    const userMsg: ChatMessage = { role: "user", content: trimmed };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");

    chatMutation.mutate({ message: trimmed });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-screen bg-background" data-testid="page-chat">
      <header className="flex items-center justify-between gap-2 px-4 py-3 border-b flex-wrap" data-testid="header-darvis">
        <div className="flex items-center gap-2.5" data-testid="header-brand">
          <div className="w-8 h-8 rounded-md bg-primary flex items-center justify-center">
            <Brain className="w-4 h-4 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-tight leading-none" data-testid="text-app-title">DARVIS</h1>
            <p className="text-[10px] text-muted-foreground leading-tight mt-0.5" data-testid="text-app-version">DiAn Raha Vision v0.1</p>
          </div>
        </div>
        <div className="flex items-center gap-1 flex-wrap">
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
            size="sm"
            onClick={() => clearMutation.mutate()}
            disabled={messages.length === 0 || clearMutation.isPending}
            data-testid="button-clear-chat"
          >
            <Trash2 className="w-3.5 h-3.5 mr-1.5" />
            Clear
          </Button>
        </div>
      </header>

      {showPrefs && (
        <div className="border-b px-4 py-3 bg-card/50 max-h-[40vh] overflow-y-auto" data-testid="panel-preferences">
          <div className="max-w-2xl mx-auto">
            <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
              <div className="flex items-center gap-2">
                <Lightbulb className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-semibold" data-testid="text-prefs-title">Yang DARVIS Pelajari</h3>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setShowPrefs(false)} data-testid="button-close-preferences">
                <X className="w-3.5 h-3.5" />
              </Button>
            </div>
            {(!prefsData?.preferences || prefsData.preferences.length === 0) ? (
              <p className="text-xs text-muted-foreground py-2" data-testid="text-prefs-empty">
                Belum ada insight yang dipelajari. DARVIS akan mulai belajar setelah beberapa percakapan.
              </p>
            ) : (
              <div className="space-y-2" data-testid="container-prefs-list">
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
                        <p className="text-xs leading-relaxed">{item.insight}</p>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-4" ref={scrollRef} data-testid="container-messages">
        <div className="py-4 space-y-3 max-w-2xl mx-auto">
          {historyLoading && (
            <div className="flex items-center justify-center py-16" data-testid="status-loading-history">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          )}

          {!historyLoading && messages.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center" data-testid="empty-state">
              <div className="w-14 h-14 rounded-md bg-primary/10 flex items-center justify-center mb-4">
                <Brain className="w-7 h-7 text-primary" />
              </div>
              <h2 className="text-base font-semibold mb-1" data-testid="text-greeting">Halo, mas DR</h2>
              <p className="text-sm text-muted-foreground max-w-xs" data-testid="text-tagline">
                Aku di sini supaya kamu tidak berpikir sendirian.
              </p>
              <div className="flex flex-wrap gap-2 justify-center mt-6">
                {[
                  "Apa itu DARVIS?",
                  "Ceritakan tentang Solid Group",
                  "Bantu saya berpikir jernih",
                ].map((q, i) => (
                  <button
                    key={q}
                    onClick={() => {
                      setInput(q);
                      inputRef.current?.focus();
                    }}
                    className="px-3 py-1.5 text-xs rounded-md border bg-card text-foreground hover-elevate active-elevate-2 transition-colors"
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
              <UserBubble key={i} content={msg.content} index={i} />
            ) : (
              <AssistantBubble key={i} content={msg.content} index={i} />
            ),
          )}

          {chatMutation.isPending && <TypingIndicator />}
        </div>
      </div>

      <div className="border-t px-4 py-3 bg-background" data-testid="container-input">
        <div className="max-w-2xl mx-auto flex items-end gap-2">
          <Textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ketik pesan untuk DARVIS..."
            rows={1}
            className="flex-1 resize-none min-h-[38px] max-h-[120px] text-sm"
            onInput={(e) => {
              const target = e.target as HTMLTextAreaElement;
              target.style.height = "auto";
              target.style.height = Math.min(target.scrollHeight, 120) + "px";
            }}
            disabled={chatMutation.isPending}
            data-testid="input-message"
          />
          <Button
            onClick={handleSend}
            disabled={!input.trim() || chatMutation.isPending}
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
