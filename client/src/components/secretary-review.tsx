import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { X, Check, XCircle, Calendar, ClipboardList, FolderKanban, CheckSquare, Square, Loader2 } from "lucide-react";

interface PendingItem {
  id: number;
  type: string;
  data: any;
  status: string;
  created_at: string;
}

const TYPE_LABELS: Record<string, string> = {
  meeting: "Meeting",
  action_item: "Action Item",
  project: "Project",
};

const TYPE_ICONS: Record<string, typeof Calendar> = {
  meeting: Calendar,
  action_item: ClipboardList,
  project: FolderKanban,
};

const TYPE_COLORS: Record<string, string> = {
  meeting: "text-blue-500 bg-blue-500/10",
  action_item: "text-amber-500 bg-amber-500/10",
  project: "text-emerald-500 bg-emerald-500/10",
};

function formatItemPreview(item: PendingItem): string {
  const d = item.data;
  if (item.type === "meeting") {
    let text = d.title || "Meeting";
    if (d.date_time) text += ` — ${d.date_time}`;
    if (d.participants) text += ` (${d.participants})`;
    return text;
  } else if (item.type === "action_item") {
    let text = d.title || "Action Item";
    if (d.assignee) text += ` → ${d.assignee}`;
    if (d.deadline) text += ` (deadline: ${d.deadline})`;
    if (d.priority && d.priority !== "medium") text += ` [${d.priority}]`;
    return text;
  } else if (item.type === "project") {
    let text = d.name || "Project";
    if (d.status) text += ` — ${d.status}`;
    if (d.pic) text += ` (PIC: ${d.pic})`;
    return text;
  }
  return JSON.stringify(d);
}

interface SecretaryReviewProps {
  onClose: () => void;
  onCountUpdate?: (count: number) => void;
}

export function SecretaryReview({ onClose, onCountUpdate }: SecretaryReviewProps) {
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const { data, isLoading, refetch } = useQuery<{ items: PendingItem[] }>({
    queryKey: ["/api/secretary/pending"],
    refetchInterval: 10000,
  });

  const items = data?.items || [];

  useEffect(() => {
    if (onCountUpdate) onCountUpdate(items.length);
  }, [items.length, onCountUpdate]);

  const approveMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("POST", "/api/secretary/approve", { id });
    },
    onSuccess: () => {
      refetch();
      queryClient.invalidateQueries({ queryKey: ["/api/meetings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/action-items"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("POST", "/api/secretary/reject", { id });
    },
    onSuccess: () => { refetch(); },
  });

  const approveAllMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/secretary/approve-all");
    },
    onSuccess: () => {
      refetch();
      queryClient.invalidateQueries({ queryKey: ["/api/meetings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/action-items"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
    },
  });

  const rejectAllMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/secretary/reject-all");
    },
    onSuccess: () => { refetch(); },
  });

  const toggleSelect = (id: number) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selected.size === items.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(items.map(i => i.id)));
    }
  };

  const approveSelected = async () => {
    for (const id of selected) {
      try { await apiRequest("POST", "/api/secretary/approve", { id }); } catch (_) {}
    }
    setSelected(new Set());
    refetch();
    queryClient.invalidateQueries({ queryKey: ["/api/meetings"] });
    queryClient.invalidateQueries({ queryKey: ["/api/action-items"] });
    queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
  };

  const rejectSelected = async () => {
    for (const id of selected) {
      try { await apiRequest("POST", "/api/secretary/reject", { id }); } catch (_) {}
    }
    setSelected(new Set());
    refetch();
  };

  const grouped = {
    meeting: items.filter(i => i.type === "meeting"),
    action_item: items.filter(i => i.type === "action_item"),
    project: items.filter(i => i.type === "project"),
  };

  const isBusy = approveMutation.isPending || rejectMutation.isPending || approveAllMutation.isPending || rejectAllMutation.isPending;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" data-testid="modal-secretary-review">
      <div className="bg-card border rounded-lg shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h2 className="text-sm font-semibold" data-testid="text-review-title">Tinjau Hasil Sekretaris ({items.length} item)</h2>
          <Button variant="ghost" size="icon" onClick={onClose} className="h-7 w-7" data-testid="button-close-review">
            <X className="w-4 h-4" />
          </Button>
        </div>

        {items.length > 1 && (
          <div className="flex items-center gap-2 px-4 py-2 border-b bg-muted/20">
            <Button size="sm" variant="ghost" className="text-xs h-7 gap-1" onClick={toggleSelectAll} data-testid="button-select-all-review">
              {selected.size === items.length ? <CheckSquare className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
              {selected.size === items.length ? "Batal Pilih" : "Pilih Semua"}
            </Button>
            {selected.size > 0 && (
              <>
                <Button size="sm" variant="default" className="text-xs h-7 gap-1" onClick={approveSelected} disabled={isBusy} data-testid="button-approve-selected">
                  <Check className="w-3 h-3" /> Approve {selected.size}
                </Button>
                <Button size="sm" variant="destructive" className="text-xs h-7 gap-1" onClick={rejectSelected} disabled={isBusy} data-testid="button-reject-selected">
                  <XCircle className="w-3 h-3" /> Reject {selected.size}
                </Button>
              </>
            )}
            {selected.size === 0 && (
              <>
                <Button size="sm" variant="default" className="text-xs h-7 gap-1" onClick={() => approveAllMutation.mutate()} disabled={isBusy} data-testid="button-approve-all">
                  <Check className="w-3 h-3" /> Approve Semua
                </Button>
                <Button size="sm" variant="outline" className="text-xs h-7 gap-1" onClick={() => rejectAllMutation.mutate()} disabled={isBusy} data-testid="button-reject-all">
                  <XCircle className="w-3 h-3" /> Reject Semua
                </Button>
              </>
            )}
          </div>
        )}

        <div className="overflow-y-auto flex-1 px-4 py-2">
          {isLoading && (
            <div className="flex justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          )}

          {!isLoading && items.length === 0 && (
            <div className="py-8 text-center text-xs text-muted-foreground" data-testid="text-no-pending">
              Tidak ada item pending
            </div>
          )}

          {(["meeting", "action_item", "project"] as const).map(type => {
            const group = grouped[type];
            if (group.length === 0) return null;
            const Icon = TYPE_ICONS[type];
            const colors = TYPE_COLORS[type];
            return (
              <div key={type} className="mb-3">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Icon className={`w-3.5 h-3.5 ${colors.split(" ")[0]}`} />
                  <span className="text-xs font-medium">{TYPE_LABELS[type]} ({group.length})</span>
                </div>
                {group.map(item => (
                  <div
                    key={item.id}
                    className="flex items-start gap-2 py-1.5 px-2 rounded hover:bg-muted/30"
                    data-testid={`pending-item-${item.id}`}
                  >
                    {items.length > 1 && (
                      <button onClick={() => toggleSelect(item.id)} className="mt-0.5 shrink-0" data-testid={`checkbox-pending-${item.id}`}>
                        {selected.has(item.id) ? <CheckSquare className="w-3.5 h-3.5 text-primary" /> : <Square className="w-3.5 h-3.5 text-muted-foreground" />}
                      </button>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs leading-snug" data-testid={`text-pending-preview-${item.id}`}>{formatItemPreview(item)}</p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => approveMutation.mutate(item.id)} disabled={isBusy} data-testid={`button-approve-${item.id}`}>
                        <Check className="w-3 h-3 text-emerald-500" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => rejectMutation.mutate(item.id)} disabled={isBusy} data-testid={`button-reject-${item.id}`}>
                        <XCircle className="w-3 h-3 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
