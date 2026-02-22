import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  X,
  Users,
  Calendar,
  CheckSquare,
  FolderKanban,
  Plus,
  Trash2,
  Edit2,
  Check,
  Square,
  Loader2,
  AlertTriangle,
  Clock,
  ChevronDown,
  ChevronUp,
  Brain,
} from "lucide-react";

interface TeamMember {
  id: number;
  name: string;
  position: string | null;
  strengths: string | null;
  weaknesses: string | null;
  responsibilities: string | null;
  active_projects: string | null;
  notes: string | null;
  aliases: string | null;
  category: string;
  work_style: string | null;
  communication_style: string | null;
  triggers: string | null;
  commitments: string | null;
  personality_notes: string | null;
  status: string;
}

interface Meeting {
  id: number;
  title: string;
  date_time: string | null;
  participants: string | null;
  agenda: string | null;
  status: string;
  summary: string | null;
  decisions: string | null;
}

interface ActionItem {
  id: number;
  title: string;
  assignee: string | null;
  deadline: string | null;
  status: string;
  priority: string;
  source: string | null;
  meeting_id: number | null;
  notes: string | null;
  completed_at: string | null;
}

interface Project {
  id: number;
  name: string;
  description: string | null;
  pic: string | null;
  status: string;
  milestones: string | null;
  deadline: string | null;
  progress: number;
  notes: string | null;
}

interface DashboardSummary {
  team_count: number;
  upcoming_meetings: number;
  today_meetings: number;
  pending_actions: number;
  overdue_actions: number;
  active_projects: number;
  unread_notifications: number;
}

type TabKey = "tim" | "meeting" | "action" | "projects";

const TABS: { key: TabKey; label: string; icon: typeof Users }[] = [
  { key: "tim", label: "Tim", icon: Users },
  { key: "meeting", label: "Meeting", icon: Calendar },
  { key: "action", label: "Action Items", icon: CheckSquare },
  { key: "projects", label: "Proyek", icon: FolderKanban },
];

const PRIORITY_COLORS: Record<string, string> = {
  high: "bg-red-500/15 text-red-600 dark:text-red-400 border-transparent",
  medium: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-transparent",
  low: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-transparent",
};

function SummaryRow({ summary, isLoading }: { summary?: DashboardSummary; isLoading: boolean }) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-3">
        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!summary) return null;

  const stats = [
    { label: "Tim", value: summary.team_count, icon: Users },
    { label: "Meeting Hari Ini", value: summary.today_meetings, icon: Calendar },
    { label: "Pending", value: summary.pending_actions, icon: Clock },
    { label: "Overdue", value: summary.overdue_actions, icon: AlertTriangle },
    { label: "Proyek Aktif", value: summary.active_projects, icon: FolderKanban },
  ];

  return (
    <div className="flex gap-2 overflow-x-auto px-3 py-2 no-scrollbar" data-testid="summary-row">
      {stats.map((s) => {
        const Icon = s.icon;
        return (
          <Card key={s.label} className="flex items-center gap-1.5 px-2.5 py-1.5 shrink-0">
            <Icon className="w-3 h-3 text-muted-foreground" />
            <span className="text-xs font-semibold" data-testid={`stat-value-${s.label}`}>{s.value}</span>
            <span className="text-[10px] text-muted-foreground">{s.label}</span>
          </Card>
        );
      })}
    </div>
  );
}

function PersonaDetail({ label, value, testId }: { label: string; value: string; testId: string }) {
  return (
    <div className="flex flex-col gap-0.5" data-testid={testId}>
      <span className="text-[9px] font-medium text-muted-foreground uppercase tracking-wider">{label}</span>
      <span className="text-[10px] leading-relaxed">{value}</span>
    </div>
  );
}

function TeamTab() {
  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [addName, setAddName] = useState("");
  const [addPosition, setAddPosition] = useState("");
  const [editName, setEditName] = useState("");
  const [editPosition, setEditPosition] = useState("");

  const { data, isLoading } = useQuery<{ members: TeamMember[] }>({
    queryKey: ["/api/team"],
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/team", { name: addName, position: addPosition || null });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/team"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      setAddName("");
      setAddPosition("");
      setShowAdd(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("PATCH", `/api/team/${id}`, { name: editName, position: editPosition || null });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/team"] });
      setEditId(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/team/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/team"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
    },
  });

  const members = data?.members || [];

  if (isLoading) {
    return <div className="flex items-center justify-center py-8"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="flex flex-col gap-2 px-3 pb-3">
      {members.length === 0 && !showAdd && (
        <p className="text-xs text-muted-foreground text-center py-6" data-testid="text-empty-team">Belum ada anggota tim</p>
      )}
      {members.map((m) => (
        <Card key={m.id} className="p-2.5" data-testid={`card-team-${m.id}`}>
          {editId === m.id ? (
            <div className="flex flex-col gap-1.5">
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Nama"
                className="text-xs h-7"
                data-testid={`input-edit-team-name-${m.id}`}
              />
              <Input
                value={editPosition}
                onChange={(e) => setEditPosition(e.target.value)}
                placeholder="Posisi"
                className="text-xs h-7"
                data-testid={`input-edit-team-position-${m.id}`}
              />
              <div className="flex gap-1 justify-end">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setEditId(null)}
                  data-testid={`button-cancel-edit-team-${m.id}`}
                >
                  Batal
                </Button>
                <Button
                  size="sm"
                  onClick={() => updateMutation.mutate(m.id)}
                  disabled={!editName.trim() || updateMutation.isPending}
                  data-testid={`button-save-team-${m.id}`}
                >
                  {updateMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                  Simpan
                </Button>
              </div>
            </div>
          ) : (
            <div>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1 flex-wrap">
                    <p className="text-xs font-medium truncate" data-testid={`text-team-name-${m.id}`}>{m.name}</p>
                    {m.category && m.category !== "team" && (
                      <Badge variant="outline" data-testid={`badge-team-category-${m.id}`}>
                        {m.category === "direksi" ? "Direksi" : m.category === "family" ? "Keluarga" : m.category === "management" ? "Mgmt" : m.category}
                      </Badge>
                    )}
                    {(m.work_style || m.communication_style || m.triggers || m.commitments || m.personality_notes) && (
                      <Brain className="w-3 h-3 text-violet-500" data-testid={`icon-persona-${m.id}`} />
                    )}
                  </div>
                  {m.position && <p className="text-[10px] text-muted-foreground truncate" data-testid={`text-team-position-${m.id}`}>{m.position}</p>}
                  {m.responsibilities && <p className="text-[10px] text-blue-600 dark:text-blue-400 truncate" data-testid={`text-team-jobdesk-${m.id}`}>Job desk: {m.responsibilities}</p>}
                  {m.aliases && <p className="text-[9px] text-muted-foreground/70 truncate italic" data-testid={`text-team-aliases-${m.id}`}>alias: {m.aliases}</p>}
                </div>
                <div className="flex gap-0.5 shrink-0">
                  {(m.work_style || m.communication_style || m.triggers || m.commitments || m.personality_notes || m.strengths || m.weaknesses) && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setExpandedId(expandedId === m.id ? null : m.id)}
                      data-testid={`button-expand-team-${m.id}`}
                    >
                      {expandedId === m.id ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => { setEditId(m.id); setEditName(m.name); setEditPosition(m.position || ""); }}
                    data-testid={`button-edit-team-${m.id}`}
                  >
                    <Edit2 className="w-3 h-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => deleteMutation.mutate(m.id)}
                    disabled={deleteMutation.isPending}
                    data-testid={`button-delete-team-${m.id}`}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>
              {expandedId === m.id && (
                <div className="mt-2 pt-2 border-t flex flex-col gap-1.5" data-testid={`panel-persona-${m.id}`}>
                  {m.strengths && <PersonaDetail label="Kelebihan" value={m.strengths} testId={`text-strengths-${m.id}`} />}
                  {m.weaknesses && <PersonaDetail label="Kelemahan" value={m.weaknesses} testId={`text-weaknesses-${m.id}`} />}
                  {m.work_style && <PersonaDetail label="Gaya Kerja" value={m.work_style} testId={`text-work-style-${m.id}`} />}
                  {m.communication_style && <PersonaDetail label="Gaya Komunikasi" value={m.communication_style} testId={`text-comm-style-${m.id}`} />}
                  {m.triggers && <PersonaDetail label="Trigger / Sensitif" value={m.triggers} testId={`text-triggers-${m.id}`} />}
                  {m.commitments && <PersonaDetail label="Komitmen" value={m.commitments} testId={`text-commitments-${m.id}`} />}
                  {m.personality_notes && <PersonaDetail label="Catatan Karakter" value={m.personality_notes} testId={`text-personality-${m.id}`} />}
                  {!m.work_style && !m.communication_style && !m.triggers && !m.commitments && !m.personality_notes && (
                    <p className="text-[9px] text-muted-foreground italic" data-testid={`text-no-persona-${m.id}`}>Belum ada profil persona — ceritakan tentang orang ini ke DARVIS untuk mengisi otomatis</p>
                  )}
                </div>
              )}
            </div>
          )}
        </Card>
      ))}

      {showAdd ? (
        <Card className="p-2.5">
          <div className="flex flex-col gap-1.5">
            <Input
              value={addName}
              onChange={(e) => setAddName(e.target.value)}
              placeholder="Nama anggota"
              className="text-xs h-7"
              autoFocus
              data-testid="input-add-team-name"
            />
            <Input
              value={addPosition}
              onChange={(e) => setAddPosition(e.target.value)}
              placeholder="Posisi (opsional)"
              className="text-xs h-7"
              data-testid="input-add-team-position"
            />
            <div className="flex gap-1 justify-end">
              <Button variant="ghost" size="sm" onClick={() => { setShowAdd(false); setAddName(""); setAddPosition(""); }} data-testid="button-cancel-add-team">
                Batal
              </Button>
              <Button
                size="sm"
                onClick={() => addMutation.mutate()}
                disabled={!addName.trim() || addMutation.isPending}
                data-testid="button-submit-add-team"
              >
                {addMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                Tambah
              </Button>
            </div>
          </div>
        </Card>
      ) : (
        <Button variant="outline" size="sm" onClick={() => setShowAdd(true)} className="w-full" data-testid="button-add-team">
          <Plus className="w-3 h-3" /> Tambah Anggota
        </Button>
      )}
    </div>
  );
}

function MeetingTab() {
  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [addTitle, setAddTitle] = useState("");
  const [addDateTime, setAddDateTime] = useState("");
  const [editTitle, setEditTitle] = useState("");
  const [editDateTime, setEditDateTime] = useState("");

  const { data, isLoading } = useQuery<{ meetings: Meeting[] }>({
    queryKey: ["/api/meetings"],
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/meetings", { title: addTitle, date_time: addDateTime || null });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/meetings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      setAddTitle("");
      setAddDateTime("");
      setShowAdd(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("PATCH", `/api/meetings/${id}`, { title: editTitle, date_time: editDateTime || null });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/meetings"] });
      setEditId(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/meetings/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/meetings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
    },
  });

  const meetings = data?.meetings || [];

  if (isLoading) {
    return <div className="flex items-center justify-center py-8"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="flex flex-col gap-2 px-3 pb-3">
      {meetings.length === 0 && !showAdd && (
        <p className="text-xs text-muted-foreground text-center py-6" data-testid="text-empty-meetings">Belum ada meeting</p>
      )}
      {meetings.map((m) => (
        <Card key={m.id} className="p-2.5" data-testid={`card-meeting-${m.id}`}>
          {editId === m.id ? (
            <div className="flex flex-col gap-1.5">
              <Input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                placeholder="Judul meeting"
                className="text-xs h-7"
                data-testid={`input-edit-meeting-title-${m.id}`}
              />
              <Input
                type="datetime-local"
                value={editDateTime}
                onChange={(e) => setEditDateTime(e.target.value)}
                className="text-xs h-7"
                data-testid={`input-edit-meeting-datetime-${m.id}`}
              />
              <div className="flex gap-1 justify-end">
                <Button variant="ghost" size="sm" onClick={() => setEditId(null)} data-testid={`button-cancel-edit-meeting-${m.id}`}>
                  Batal
                </Button>
                <Button
                  size="sm"
                  onClick={() => updateMutation.mutate(m.id)}
                  disabled={!editTitle.trim() || updateMutation.isPending}
                  data-testid={`button-save-meeting-${m.id}`}
                >
                  {updateMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                  Simpan
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium truncate" data-testid={`text-meeting-title-${m.id}`}>{m.title}</p>
                {m.date_time && (
                  <p className="text-[10px] text-muted-foreground" data-testid={`text-meeting-datetime-${m.id}`}>
                    {new Date(m.date_time).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}
                  </p>
                )}
                {m.participants && <p className="text-[10px] text-muted-foreground truncate" data-testid={`text-meeting-participants-${m.id}`}>{m.participants}</p>}
              </div>
              <div className="flex gap-0.5 shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => { setEditId(m.id); setEditTitle(m.title); setEditDateTime(m.date_time || ""); }}
                  data-testid={`button-edit-meeting-${m.id}`}
                >
                  <Edit2 className="w-3 h-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => deleteMutation.mutate(m.id)}
                  disabled={deleteMutation.isPending}
                  data-testid={`button-delete-meeting-${m.id}`}
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            </div>
          )}
        </Card>
      ))}

      {showAdd ? (
        <Card className="p-2.5">
          <div className="flex flex-col gap-1.5">
            <Input
              value={addTitle}
              onChange={(e) => setAddTitle(e.target.value)}
              placeholder="Judul meeting"
              className="text-xs h-7"
              autoFocus
              data-testid="input-add-meeting-title"
            />
            <Input
              type="datetime-local"
              value={addDateTime}
              onChange={(e) => setAddDateTime(e.target.value)}
              className="text-xs h-7"
              data-testid="input-add-meeting-datetime"
            />
            <div className="flex gap-1 justify-end">
              <Button variant="ghost" size="sm" onClick={() => { setShowAdd(false); setAddTitle(""); setAddDateTime(""); }} data-testid="button-cancel-add-meeting">
                Batal
              </Button>
              <Button
                size="sm"
                onClick={() => addMutation.mutate()}
                disabled={!addTitle.trim() || addMutation.isPending}
                data-testid="button-submit-add-meeting"
              >
                {addMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                Tambah
              </Button>
            </div>
          </div>
        </Card>
      ) : (
        <Button variant="outline" size="sm" onClick={() => setShowAdd(true)} className="w-full" data-testid="button-add-meeting">
          <Plus className="w-3 h-3" /> Tambah Meeting
        </Button>
      )}
    </div>
  );
}

function ActionItemsTab() {
  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [addTitle, setAddTitle] = useState("");
  const [addAssignee, setAddAssignee] = useState("");
  const [addPriority, setAddPriority] = useState("medium");
  const [editTitle, setEditTitle] = useState("");
  const [editAssignee, setEditAssignee] = useState("");

  const { data, isLoading } = useQuery<{ items: ActionItem[] }>({
    queryKey: ["/api/action-items"],
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/action-items", {
        title: addTitle,
        assignee: addAssignee || null,
        priority: addPriority,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/action-items"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      setAddTitle("");
      setAddAssignee("");
      setAddPriority("medium");
      setShowAdd(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data: updateData }: { id: number; data: Record<string, unknown> }) => {
      await apiRequest("PATCH", `/api/action-items/${id}`, updateData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/action-items"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      setEditId(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/action-items/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/action-items"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
    },
  });

  const toggleStatus = (item: ActionItem) => {
    const newStatus = item.status === "done" ? "pending" : "done";
    updateMutation.mutate({
      id: item.id,
      data: { status: newStatus, completed_at: newStatus === "done" ? new Date().toISOString() : null },
    });
  };

  const items = data?.items || [];

  if (isLoading) {
    return <div className="flex items-center justify-center py-8"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="flex flex-col gap-2 px-3 pb-3">
      {items.length === 0 && !showAdd && (
        <p className="text-xs text-muted-foreground text-center py-6" data-testid="text-empty-actions">Belum ada action item</p>
      )}
      {items.map((item) => (
        <Card key={item.id} className="p-2.5" data-testid={`card-action-${item.id}`}>
          {editId === item.id ? (
            <div className="flex flex-col gap-1.5">
              <Input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                placeholder="Judul"
                className="text-xs h-7"
                data-testid={`input-edit-action-title-${item.id}`}
              />
              <Input
                value={editAssignee}
                onChange={(e) => setEditAssignee(e.target.value)}
                placeholder="Assignee"
                className="text-xs h-7"
                data-testid={`input-edit-action-assignee-${item.id}`}
              />
              <div className="flex gap-1 justify-end">
                <Button variant="ghost" size="sm" onClick={() => setEditId(null)} data-testid={`button-cancel-edit-action-${item.id}`}>
                  Batal
                </Button>
                <Button
                  size="sm"
                  onClick={() => updateMutation.mutate({ id: item.id, data: { title: editTitle, assignee: editAssignee || null } })}
                  disabled={!editTitle.trim() || updateMutation.isPending}
                  data-testid={`button-save-action-${item.id}`}
                >
                  {updateMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                  Simpan
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-2">
              <button
                onClick={() => toggleStatus(item)}
                className="mt-0.5 shrink-0 text-muted-foreground"
                data-testid={`button-toggle-action-${item.id}`}
              >
                {item.status === "done" ? (
                  <CheckSquare className="w-4 h-4 text-emerald-500" />
                ) : (
                  <Square className="w-4 h-4" />
                )}
              </button>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <p className={`text-xs font-medium ${item.status === "done" ? "line-through text-muted-foreground" : ""}`} data-testid={`text-action-title-${item.id}`}>
                    {item.title}
                  </p>
                  <Badge variant="secondary" className={`text-[9px] py-0 px-1.5 no-default-hover-elevate no-default-active-elevate ${PRIORITY_COLORS[item.priority] || ""}`} data-testid={`badge-priority-${item.id}`}>
                    {item.priority}
                  </Badge>
                </div>
                {item.assignee && <p className="text-[10px] text-muted-foreground" data-testid={`text-action-assignee-${item.id}`}>{item.assignee}</p>}
                {item.deadline && <p className="text-[10px] text-muted-foreground" data-testid={`text-action-deadline-${item.id}`}>{new Date(item.deadline).toLocaleDateString("id-ID")}</p>}
              </div>
              <div className="flex gap-0.5 shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => { setEditId(item.id); setEditTitle(item.title); setEditAssignee(item.assignee || ""); }}
                  data-testid={`button-edit-action-${item.id}`}
                >
                  <Edit2 className="w-3 h-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => deleteMutation.mutate(item.id)}
                  disabled={deleteMutation.isPending}
                  data-testid={`button-delete-action-${item.id}`}
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            </div>
          )}
        </Card>
      ))}

      {showAdd ? (
        <Card className="p-2.5">
          <div className="flex flex-col gap-1.5">
            <Input
              value={addTitle}
              onChange={(e) => setAddTitle(e.target.value)}
              placeholder="Judul action item"
              className="text-xs h-7"
              autoFocus
              data-testid="input-add-action-title"
            />
            <Input
              value={addAssignee}
              onChange={(e) => setAddAssignee(e.target.value)}
              placeholder="Assignee (opsional)"
              className="text-xs h-7"
              data-testid="input-add-action-assignee"
            />
            <div className="flex gap-1 items-center">
              <span className="text-[10px] text-muted-foreground shrink-0">Prioritas:</span>
              <div className="flex gap-1">
                {(["low", "medium", "high"] as const).map((p) => (
                  <Button
                    key={p}
                    variant="ghost"
                    size="sm"
                    className={`text-[10px] px-2 toggle-elevate ${addPriority === p ? "toggle-elevated" : ""}`}
                    onClick={() => setAddPriority(p)}
                    data-testid={`button-priority-${p}`}
                  >
                    {p === "low" ? "Rendah" : p === "medium" ? "Sedang" : "Tinggi"}
                  </Button>
                ))}
              </div>
            </div>
            <div className="flex gap-1 justify-end">
              <Button variant="ghost" size="sm" onClick={() => { setShowAdd(false); setAddTitle(""); setAddAssignee(""); }} data-testid="button-cancel-add-action">
                Batal
              </Button>
              <Button
                size="sm"
                onClick={() => addMutation.mutate()}
                disabled={!addTitle.trim() || addMutation.isPending}
                data-testid="button-submit-add-action"
              >
                {addMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                Tambah
              </Button>
            </div>
          </div>
        </Card>
      ) : (
        <Button variant="outline" size="sm" onClick={() => setShowAdd(true)} className="w-full" data-testid="button-add-action">
          <Plus className="w-3 h-3" /> Tambah Action Item
        </Button>
      )}
    </div>
  );
}

function ProjectsTab() {
  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [addName, setAddName] = useState("");
  const [addPic, setAddPic] = useState("");
  const [editName, setEditName] = useState("");
  const [editPic, setEditPic] = useState("");

  const { data, isLoading } = useQuery<{ projects: Project[] }>({
    queryKey: ["/api/projects"],
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/projects", {
        name: addName,
        pic: addPic || null,
        status: "active",
        progress: 0,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      setAddName("");
      setAddPic("");
      setShowAdd(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data: updateData }: { id: number; data: Record<string, unknown> }) => {
      await apiRequest("PATCH", `/api/projects/${id}`, updateData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      setEditId(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/projects/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
    },
  });

  const projects = data?.projects || [];

  if (isLoading) {
    return <div className="flex items-center justify-center py-8"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="flex flex-col gap-2 px-3 pb-3">
      {projects.length === 0 && !showAdd && (
        <p className="text-xs text-muted-foreground text-center py-6" data-testid="text-empty-projects">Belum ada proyek</p>
      )}
      {projects.map((p) => (
        <Card key={p.id} className="p-2.5" data-testid={`card-project-${p.id}`}>
          {editId === p.id ? (
            <div className="flex flex-col gap-1.5">
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Nama proyek"
                className="text-xs h-7"
                data-testid={`input-edit-project-name-${p.id}`}
              />
              <Input
                value={editPic}
                onChange={(e) => setEditPic(e.target.value)}
                placeholder="PIC"
                className="text-xs h-7"
                data-testid={`input-edit-project-pic-${p.id}`}
              />
              <div className="flex gap-1 justify-end">
                <Button variant="ghost" size="sm" onClick={() => setEditId(null)} data-testid={`button-cancel-edit-project-${p.id}`}>
                  Batal
                </Button>
                <Button
                  size="sm"
                  onClick={() => updateMutation.mutate({ id: p.id, data: { name: editName, pic: editPic || null } })}
                  disabled={!editName.trim() || updateMutation.isPending}
                  data-testid={`button-save-project-${p.id}`}
                >
                  {updateMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                  Simpan
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <p className="text-xs font-medium truncate" data-testid={`text-project-name-${p.id}`}>{p.name}</p>
                  <Badge variant="secondary" className="text-[9px] py-0 px-1.5 no-default-hover-elevate no-default-active-elevate" data-testid={`badge-project-status-${p.id}`}>
                    {p.status}
                  </Badge>
                </div>
                {p.pic && <p className="text-[10px] text-muted-foreground" data-testid={`text-project-pic-${p.id}`}>PIC: {p.pic}</p>}
                <div className="flex items-center gap-1.5 mt-1">
                  <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all"
                      style={{ width: `${p.progress}%` }}
                      data-testid={`progress-bar-${p.id}`}
                    />
                  </div>
                  <span className="text-[10px] text-muted-foreground shrink-0" data-testid={`text-project-progress-${p.id}`}>{p.progress}%</span>
                </div>
                {p.deadline && <p className="text-[10px] text-muted-foreground mt-0.5" data-testid={`text-project-deadline-${p.id}`}>Deadline: {new Date(p.deadline).toLocaleDateString("id-ID")}</p>}
              </div>
              <div className="flex gap-0.5 shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => { setEditId(p.id); setEditName(p.name); setEditPic(p.pic || ""); }}
                  data-testid={`button-edit-project-${p.id}`}
                >
                  <Edit2 className="w-3 h-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => deleteMutation.mutate(p.id)}
                  disabled={deleteMutation.isPending}
                  data-testid={`button-delete-project-${p.id}`}
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            </div>
          )}
        </Card>
      ))}

      {showAdd ? (
        <Card className="p-2.5">
          <div className="flex flex-col gap-1.5">
            <Input
              value={addName}
              onChange={(e) => setAddName(e.target.value)}
              placeholder="Nama proyek"
              className="text-xs h-7"
              autoFocus
              data-testid="input-add-project-name"
            />
            <Input
              value={addPic}
              onChange={(e) => setAddPic(e.target.value)}
              placeholder="PIC (opsional)"
              className="text-xs h-7"
              data-testid="input-add-project-pic"
            />
            <div className="flex gap-1 justify-end">
              <Button variant="ghost" size="sm" onClick={() => { setShowAdd(false); setAddName(""); setAddPic(""); }} data-testid="button-cancel-add-project">
                Batal
              </Button>
              <Button
                size="sm"
                onClick={() => addMutation.mutate()}
                disabled={!addName.trim() || addMutation.isPending}
                data-testid="button-submit-add-project"
              >
                {addMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                Tambah
              </Button>
            </div>
          </div>
        </Card>
      ) : (
        <Button variant="outline" size="sm" onClick={() => setShowAdd(true)} className="w-full" data-testid="button-add-project">
          <Plus className="w-3 h-3" /> Tambah Proyek
        </Button>
      )}
    </div>
  );
}

export function SecretaryDashboard({ onClose }: { onClose: () => void }) {
  const [activeTab, setActiveTab] = useState<TabKey>("tim");

  const { data: summaryData, isLoading: summaryLoading } = useQuery<DashboardSummary>({
    queryKey: ["/api/dashboard"],
  });

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col" data-testid="panel-secretary-dashboard">
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b shrink-0 pt-[calc(0.5rem+env(safe-area-inset-top,0px))]">
        <h2 className="text-sm font-semibold" data-testid="text-dashboard-title">Secretary Dashboard</h2>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          data-testid="button-close-dashboard"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>

      <SummaryRow summary={summaryData} isLoading={summaryLoading} />

      <div className="flex gap-1 px-3 py-1.5 border-b shrink-0 overflow-x-auto no-scrollbar">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <Button
              key={tab.key}
              variant="ghost"
              size="sm"
              className={`text-xs shrink-0 gap-1.5 toggle-elevate ${activeTab === tab.key ? "toggle-elevated" : ""}`}
              onClick={() => setActiveTab(tab.key)}
              data-testid={`tab-${tab.key}`}
            >
              <Icon className="w-3 h-3" />
              {tab.label}
            </Button>
          );
        })}
      </div>

      <div className="flex-1 overflow-y-auto pt-2">
        {activeTab === "tim" && <TeamTab />}
        {activeTab === "meeting" && <MeetingTab />}
        {activeTab === "action" && <ActionItemsTab />}
        {activeTab === "projects" && <ProjectsTab />}
      </div>
    </div>
  );
}
