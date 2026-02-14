import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Bell, Trash2, X, Clock, AlertTriangle, Lightbulb, Calendar, Users, FolderKanban, Sparkles } from "lucide-react";

interface Notification {
  id: number;
  type: string;
  title: string;
  message: string;
  data: string | null;
  read: number;
  created_at: string;
}

interface NotificationResponse {
  notifications: Notification[];
  unread_count: number;
}

const TYPE_ICONS: Record<string, typeof Bell> = {
  meeting_reminder: Calendar,
  overdue_alert: AlertTriangle,
  project_deadline: Clock,
  daily_briefing: Sparkles,
  darvis_insight: Lightbulb,
  contributor_alert: Users,
  project_update: FolderKanban,
};

const TYPE_COLORS: Record<string, string> = {
  meeting_reminder: "text-blue-500",
  overdue_alert: "text-red-500",
  project_deadline: "text-amber-500",
  daily_briefing: "text-emerald-500",
  darvis_insight: "text-purple-500",
  contributor_alert: "text-cyan-500",
  project_update: "text-indigo-500",
};

function timeAgo(dateStr: string): string {
  const date = new Date(dateStr + "Z");
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "baru saja";
  if (diffMin < 60) return `${diffMin}m lalu`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}j lalu`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}h lalu`;
}

async function subscribeToPush() {
  try {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;

    const permission = await Notification.requestPermission();
    if (permission !== "granted") return;

    const registration = await navigator.serviceWorker.ready;
    const existing = await registration.pushManager.getSubscription();
    if (existing) {
      await sendSubscriptionToServer(existing);
      return;
    }

    const res = await fetch("/api/push/vapid-key");
    const { publicKey } = await res.json();
    if (!publicKey) return;

    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });
    await sendSubscriptionToServer(subscription);
  } catch {}
}

async function sendSubscriptionToServer(subscription: PushSubscriptionJSON | globalThis.PushSubscription) {
  try {
    const sub = "toJSON" in subscription && typeof subscription.toJSON === "function" ? subscription.toJSON() : subscription;
    await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subscription: sub }),
    });
  } catch {}
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

function showBrowserNotification(title: string, body: string) {
  if ("Notification" in window && Notification.permission === "granted") {
    try {
      if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: "SHOW_NOTIFICATION",
          title,
          body,
        });
      } else {
        new Notification(title, {
          body,
          icon: "/darvis-logo.png",
          badge: "/darvis-logo.png",
          tag: "darvis-notif",
        } as NotificationOptions);
      }
    } catch {
      new Notification(title, { body, icon: "/darvis-logo.png" });
    }
  }
}

export function NotificationCenter() {
  const [isOpen, setIsOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const lastSeenIdRef = useRef<number>(0);
  const initialLoadRef = useRef(true);

  useEffect(() => {
    subscribeToPush();
  }, []);

  const { data: notifData } = useQuery<NotificationResponse>({
    queryKey: ["/api/notifications"],
    refetchInterval: 15000,
  });

  const { data: countData } = useQuery<{ count: number }>({
    queryKey: ["/api/notifications/count"],
    refetchInterval: 10000,
  });

  useEffect(() => {
    if (!notifData?.notifications?.length) return;
    const unread = notifData.notifications.filter(n => n.read === 0);
    if (unread.length === 0) return;

    const maxId = Math.max(...unread.map(n => n.id));

    if (initialLoadRef.current) {
      lastSeenIdRef.current = maxId;
      initialLoadRef.current = false;
      return;
    }

    const newNotifs = unread.filter(n => n.id > lastSeenIdRef.current);
    if (newNotifs.length > 0 && !isOpen) {
      const latest = newNotifs[0];
      showBrowserNotification(latest.title, latest.message);
    }

    if (maxId > lastSeenIdRef.current) {
      lastSeenIdRef.current = maxId;
    }
  }, [notifData, isOpen]);

  const markReadMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("POST", `/api/notifications/${id}/read`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/count"] });
    },
  });

  const deleteAllMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", "/api/notifications");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/count"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/notifications/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/count"] });
    },
  });

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const unreadCount = countData?.count || 0;
  const notifications = notifData?.notifications || [];

  return (
    <div className="relative" ref={panelRef}>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setIsOpen(!isOpen)}
        className={`toggle-elevate ${isOpen ? "toggle-elevated" : ""}`}
        data-testid="button-notifications"
        title="Notifikasi"
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span
            className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold px-1"
            data-testid="badge-notification-count"
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </Button>

      {isOpen && (
        <div
          className="absolute right-0 top-full mt-1 w-80 sm:w-96 max-h-[70vh] rounded-md border bg-card shadow-lg z-50 flex flex-col"
          data-testid="panel-notifications"
        >
          <div className="flex items-center justify-between gap-2 px-3 py-2 border-b">
            <h3 className="text-xs font-semibold" data-testid="text-notifications-title">Notifikasi</h3>
            <div className="flex items-center gap-1">
              {notifications.length > 0 && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => deleteAllMutation.mutate()}
                  title="Hapus semua notifikasi"
                  data-testid="button-delete-all-notifications"
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsOpen(false)}
                className="h-6 w-6"
                data-testid="button-close-notifications"
              >
                <X className="w-3 h-3" />
              </Button>
            </div>
          </div>

          <div className="overflow-y-auto flex-1">
            {notifications.length === 0 ? (
              <div className="py-8 text-center text-xs text-muted-foreground" data-testid="text-no-notifications">
                Belum ada notifikasi
              </div>
            ) : (
              notifications.map((notif) => {
                const IconComp = TYPE_ICONS[notif.type] || Bell;
                const colorClass = TYPE_COLORS[notif.type] || "text-muted-foreground";
                return (
                  <div
                    key={notif.id}
                    className={`flex gap-2 px-3 py-2.5 border-b last:border-b-0 cursor-pointer hover-elevate ${notif.read === 0 ? "bg-muted/30" : ""}`}
                    onClick={() => {
                      if (notif.read === 0) markReadMutation.mutate(notif.id);
                    }}
                    data-testid={`notification-item-${notif.id}`}
                  >
                    <div className={`mt-0.5 shrink-0 ${colorClass}`}>
                      <IconComp className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-1">
                        <p className={`text-xs font-medium leading-tight ${notif.read === 0 ? "" : "text-muted-foreground"}`} data-testid={`text-notification-title-${notif.id}`}>
                          {notif.title}
                        </p>
                        <button
                          onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(notif.id); }}
                          className="shrink-0 text-muted-foreground/50 hover:text-destructive"
                          data-testid={`button-delete-notification-${notif.id}`}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5 whitespace-pre-line leading-snug line-clamp-3" data-testid={`text-notification-message-${notif.id}`}>
                        {notif.message}
                      </p>
                      <p className="text-[10px] text-muted-foreground/60 mt-1" data-testid={`text-notification-time-${notif.id}`}>
                        {timeAgo(notif.created_at)}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
