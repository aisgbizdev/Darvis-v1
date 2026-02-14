import Database from "better-sqlite3";
import path from "path";

const DB_PATH = path.join(process.cwd(), "darvis.db");

const db = new Database(DB_PATH);

db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS conversations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL DEFAULT 'mas_dr',
    role TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS summaries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL DEFAULT 'mas_dr' UNIQUE,
    summary TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON conversations(user_id);
  CREATE INDEX IF NOT EXISTS idx_conversations_created_at ON conversations(created_at);

  CREATE TABLE IF NOT EXISTS learned_preferences (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL DEFAULT 'mas_dr',
    category TEXT NOT NULL,
    insight TEXT NOT NULL,
    confidence REAL NOT NULL DEFAULT 0.7,
    source_summary TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_learned_prefs_user_id ON learned_preferences(user_id);
  CREATE INDEX IF NOT EXISTS idx_learned_prefs_category ON learned_preferences(category);

  CREATE TABLE IF NOT EXISTS persona_feedback (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL DEFAULT 'mas_dr',
    target TEXT NOT NULL CHECK(target IN ('dr', 'broto', 'rara', 'rere')),
    feedback TEXT NOT NULL,
    sentiment TEXT NOT NULL DEFAULT 'neutral' CHECK(sentiment IN ('positive', 'negative', 'neutral', 'mixed')),
    confidence REAL NOT NULL DEFAULT 0.7,
    source_context TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_persona_feedback_target ON persona_feedback(target);
`);

try {
  db.exec(`ALTER TABLE persona_feedback ADD COLUMN user_id TEXT NOT NULL DEFAULT 'mas_dr'`);
} catch (_e) {}

db.exec(`CREATE INDEX IF NOT EXISTS idx_persona_feedback_user_id ON persona_feedback(user_id)`);

db.exec(`
  CREATE TABLE IF NOT EXISTS profile_enrichments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL DEFAULT 'mas_dr',
    category TEXT NOT NULL,
    fact TEXT NOT NULL,
    confidence REAL NOT NULL DEFAULT 0.8,
    source_quote TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_profile_enrichments_category ON profile_enrichments(category);
`);

try {
  db.exec(`ALTER TABLE profile_enrichments ADD COLUMN user_id TEXT NOT NULL DEFAULT 'mas_dr'`);
} catch (_e) {}

db.exec(`CREATE INDEX IF NOT EXISTS idx_profile_enrichments_user_id ON profile_enrichments(user_id)`);

export function getLastMessages(userId: string, limit: number = 10) {
  const stmt = db.prepare(`
    SELECT role, content FROM conversations
    WHERE user_id = ?
    ORDER BY id DESC
    LIMIT ?
  `);
  const rows = stmt.all(userId, limit) as { role: string; content: string }[];
  return rows.reverse();
}

export function getSummary(userId: string): string | null {
  const stmt = db.prepare(`
    SELECT summary FROM summaries WHERE user_id = ?
  `);
  const row = stmt.get(userId) as { summary: string } | undefined;
  return row?.summary || null;
}

export function saveMessage(userId: string, role: "user" | "assistant", content: string) {
  const stmt = db.prepare(`
    INSERT INTO conversations (user_id, role, content) VALUES (?, ?, ?)
  `);
  stmt.run(userId, role, content);
}

export function getMessageCount(userId: string): number {
  const stmt = db.prepare(`
    SELECT COUNT(*) as count FROM conversations WHERE user_id = ?
  `);
  const row = stmt.get(userId) as { count: number };
  return row.count;
}

export function upsertSummary(userId: string, summary: string) {
  const stmt = db.prepare(`
    INSERT INTO summaries (user_id, summary, updated_at)
    VALUES (?, ?, datetime('now'))
    ON CONFLICT(user_id)
    DO UPDATE SET summary = excluded.summary, updated_at = excluded.updated_at
  `);
  stmt.run(userId, summary);
}

export function clearHistory(userId: string) {
  const delConv = db.prepare(`DELETE FROM conversations WHERE user_id = ?`);
  const delSumm = db.prepare(`DELETE FROM summaries WHERE user_id = ?`);
  const transaction = db.transaction(() => {
    delConv.run(userId);
    delSumm.run(userId);
  });
  transaction();
}

export function getAllMessages(userId: string) {
  const stmt = db.prepare(`
    SELECT role, content FROM conversations
    WHERE user_id = ?
    ORDER BY id ASC
  `);
  return stmt.all(userId) as { role: string; content: string }[];
}

export interface LearnedPreference {
  id: number;
  user_id: string;
  category: string;
  insight: string;
  confidence: number;
  source_summary: string | null;
  created_at: string;
  updated_at: string;
}

export function getLearnedPreferences(userId: string): LearnedPreference[] {
  const stmt = db.prepare(`
    SELECT * FROM learned_preferences
    WHERE user_id = ?
    ORDER BY confidence DESC, updated_at DESC
  `);
  return stmt.all(userId) as LearnedPreference[];
}

export function upsertPreference(
  userId: string,
  category: string,
  insight: string,
  confidence: number,
  sourceSummary: string | null
) {
  const existing = db.prepare(`
    SELECT id FROM learned_preferences
    WHERE user_id = ? AND category = ? AND insight = ?
  `).get(userId, category, insight) as { id: number } | undefined;

  if (existing) {
    db.prepare(`
      UPDATE learned_preferences
      SET confidence = ?, source_summary = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(confidence, sourceSummary, existing.id);
  } else {
    db.prepare(`
      INSERT INTO learned_preferences (user_id, category, insight, confidence, source_summary)
      VALUES (?, ?, ?, ?, ?)
    `).run(userId, category, insight, confidence, sourceSummary);
  }
}

export function bulkUpsertPreferences(
  userId: string,
  preferences: { category: string; insight: string; confidence: number; source_summary: string | null }[]
) {
  const transaction = db.transaction(() => {
    for (const pref of preferences) {
      upsertPreference(userId, pref.category, pref.insight, pref.confidence, pref.source_summary);
    }
  });
  transaction();
}

export function clearPreferences(userId: string) {
  db.prepare(`DELETE FROM learned_preferences WHERE user_id = ?`).run(userId);
}

export interface PersonaFeedback {
  id: number;
  user_id: string;
  target: string;
  feedback: string;
  sentiment: string;
  confidence: number;
  source_context: string | null;
  created_at: string;
}

export function getPersonaFeedback(userId: string, target?: string): PersonaFeedback[] {
  if (target) {
    return db.prepare(`SELECT * FROM persona_feedback WHERE user_id = ? AND target = ? ORDER BY confidence DESC, created_at DESC`).all(userId, target) as PersonaFeedback[];
  }
  return db.prepare(`SELECT * FROM persona_feedback WHERE user_id = ? ORDER BY target, confidence DESC, created_at DESC`).all(userId) as PersonaFeedback[];
}

export function savePersonaFeedback(
  userId: string,
  target: string,
  feedback: string,
  sentiment: string,
  confidence: number,
  sourceContext: string | null
) {
  const existing = db.prepare(`
    SELECT id FROM persona_feedback WHERE user_id = ? AND target = ? AND feedback = ?
  `).get(userId, target, feedback) as { id: number } | undefined;

  if (existing) {
    db.prepare(`
      UPDATE persona_feedback SET confidence = ?, sentiment = ?, source_context = ?, created_at = datetime('now') WHERE id = ?
    `).run(confidence, sentiment, sourceContext, existing.id);
  } else {
    db.prepare(`
      INSERT INTO persona_feedback (user_id, target, feedback, sentiment, confidence, source_context) VALUES (?, ?, ?, ?, ?, ?)
    `).run(userId, target, feedback, sentiment, confidence, sourceContext);
  }
}

export function bulkSavePersonaFeedback(
  userId: string,
  items: { target: string; feedback: string; sentiment: string; confidence: number; source_context: string | null }[]
) {
  const transaction = db.transaction(() => {
    for (const item of items) {
      savePersonaFeedback(userId, item.target, item.feedback, item.sentiment, item.confidence, item.source_context);
    }
  });
  transaction();
}

export function clearPersonaFeedback(userId: string) {
  db.prepare(`DELETE FROM persona_feedback WHERE user_id = ?`).run(userId);
}

export function getPreferenceCount(userId: string): number {
  const row = db.prepare(`SELECT COUNT(*) as count FROM learned_preferences WHERE user_id = ?`).get(userId) as { count: number };
  return row.count;
}

export interface ProfileEnrichment {
  id: number;
  user_id: string;
  category: string;
  fact: string;
  confidence: number;
  source_quote: string | null;
  created_at: string;
}

export function getProfileEnrichments(userId: string): ProfileEnrichment[] {
  return db.prepare(`SELECT * FROM profile_enrichments WHERE user_id = ? ORDER BY category, confidence DESC, created_at DESC`).all(userId) as ProfileEnrichment[];
}

export function saveProfileEnrichment(
  userId: string,
  category: string,
  fact: string,
  confidence: number,
  sourceQuote: string | null
) {
  const existing = db.prepare(`
    SELECT id FROM profile_enrichments WHERE user_id = ? AND category = ? AND fact = ?
  `).get(userId, category, fact) as { id: number } | undefined;

  if (existing) {
    db.prepare(`
      UPDATE profile_enrichments SET confidence = ?, source_quote = ?, created_at = datetime('now') WHERE id = ?
    `).run(confidence, sourceQuote, existing.id);
  } else {
    db.prepare(`
      INSERT INTO profile_enrichments (user_id, category, fact, confidence, source_quote) VALUES (?, ?, ?, ?, ?)
    `).run(userId, category, fact, confidence, sourceQuote);
  }
}

export function bulkSaveProfileEnrichments(
  userId: string,
  items: { category: string; fact: string; confidence: number; source_quote: string | null }[]
) {
  const transaction = db.transaction(() => {
    for (const item of items) {
      saveProfileEnrichment(userId, item.category, item.fact, item.confidence, item.source_quote);
    }
  });
  transaction();
}

export function clearProfileEnrichments(userId: string) {
  db.prepare(`DELETE FROM profile_enrichments WHERE user_id = ?`).run(userId);
}

db.exec(`
  CREATE TABLE IF NOT EXISTS conversation_tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    context_mode TEXT NOT NULL DEFAULT 'general',
    decision_type TEXT,
    emotional_tone TEXT,
    nodes_active TEXT,
    strategic_escalation INTEGER NOT NULL DEFAULT 0,
    fast_decision INTEGER NOT NULL DEFAULT 0,
    multi_persona INTEGER NOT NULL DEFAULT 0,
    user_message_preview TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_conversation_tags_user_id ON conversation_tags(user_id);
  CREATE INDEX IF NOT EXISTS idx_conversation_tags_context_mode ON conversation_tags(context_mode);
  CREATE INDEX IF NOT EXISTS idx_conversation_tags_created_at ON conversation_tags(created_at);
`);

export interface ConversationTag {
  id: number;
  user_id: string;
  context_mode: string;
  decision_type: string | null;
  emotional_tone: string | null;
  nodes_active: string | null;
  strategic_escalation: number;
  fast_decision: number;
  multi_persona: number;
  user_message_preview: string | null;
  created_at: string;
}

export function saveConversationTag(
  userId: string,
  tag: {
    context_mode: string;
    decision_type?: string | null;
    emotional_tone?: string | null;
    nodes_active?: string | null;
    strategic_escalation?: boolean;
    fast_decision?: boolean;
    multi_persona?: boolean;
    user_message_preview?: string | null;
  }
) {
  db.prepare(`
    INSERT INTO conversation_tags (user_id, context_mode, decision_type, emotional_tone, nodes_active, strategic_escalation, fast_decision, multi_persona, user_message_preview)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    userId,
    tag.context_mode,
    tag.decision_type || null,
    tag.emotional_tone || null,
    tag.nodes_active || null,
    tag.strategic_escalation ? 1 : 0,
    tag.fast_decision ? 1 : 0,
    tag.multi_persona ? 1 : 0,
    tag.user_message_preview || null
  );
}

export function getConversationTags(userId: string, limit: number = 50): ConversationTag[] {
  return db.prepare(`
    SELECT * FROM conversation_tags
    WHERE user_id = ?
    ORDER BY created_at DESC
    LIMIT ?
  `).all(userId, limit) as ConversationTag[];
}

export function clearConversationTags(userId: string) {
  db.prepare(`DELETE FROM conversation_tags WHERE user_id = ?`).run(userId);
}

db.exec(`
  CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

export function getSetting(key: string): string | null {
  const row = db.prepare(`SELECT value FROM app_settings WHERE key = ?`).get(key) as { value: string } | undefined;
  return row?.value || null;
}

export function setSetting(key: string, value: string) {
  db.prepare(`INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, datetime('now')) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`).run(key, value);
}

export function getPassword(type: "owner" | "contributor"): string | null {
  const dbVal = getSetting(`${type}_password`);
  if (dbVal) return dbVal;
  if (type === "owner") return process.env.OWNER_PASSWORD || null;
  if (type === "contributor") return process.env.CONTRIBUTOR_PASSWORD || null;
  return null;
}

// ==================== TEAM MEMBERS ====================
db.exec(`
  CREATE TABLE IF NOT EXISTS team_members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    position TEXT,
    strengths TEXT,
    weaknesses TEXT,
    responsibilities TEXT,
    active_projects TEXT,
    notes TEXT,
    aliases TEXT,
    category TEXT NOT NULL DEFAULT 'team' CHECK(category IN ('team', 'direksi', 'family', 'external', 'management')),
    status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'inactive')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_team_members_name ON team_members(name);
  CREATE INDEX IF NOT EXISTS idx_team_members_status ON team_members(status);
`);

try { db.exec(`ALTER TABLE team_members ADD COLUMN aliases TEXT`); } catch(e) {}
try { db.exec(`ALTER TABLE team_members ADD COLUMN category TEXT NOT NULL DEFAULT 'team'`); } catch(e) {}

export interface TeamMember {
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
  status: string;
  created_at: string;
  updated_at: string;
}

export function getTeamMembers(status?: string): TeamMember[] {
  if (status) {
    return db.prepare(`SELECT * FROM team_members WHERE status = ? ORDER BY name`).all(status) as TeamMember[];
  }
  return db.prepare(`SELECT * FROM team_members ORDER BY name`).all() as TeamMember[];
}

export function getTeamMemberByName(name: string): TeamMember | undefined {
  return db.prepare(`SELECT * FROM team_members WHERE LOWER(name) = LOWER(?)`).get(name) as TeamMember | undefined;
}

export function getTeamMemberByNameOrAlias(name: string): TeamMember | undefined {
  const trimmed = name.trim();
  if (!trimmed) return undefined;
  const byName = db.prepare(`SELECT * FROM team_members WHERE LOWER(TRIM(name)) = LOWER(?)`).get(trimmed) as TeamMember | undefined;
  if (byName) return byName;
  const allMembers = db.prepare(`SELECT * FROM team_members WHERE aliases IS NOT NULL AND aliases != ''`).all() as TeamMember[];
  const lowerName = trimmed.toLowerCase();
  for (const m of allMembers) {
    if (m.aliases) {
      const aliasList = m.aliases.split(",").map(a => a.trim().toLowerCase());
      if (aliasList.includes(lowerName)) return m;
    }
  }
  return undefined;
}

export function getTeamMemberById(id: number): TeamMember | undefined {
  return db.prepare(`SELECT * FROM team_members WHERE id = ?`).get(id) as TeamMember | undefined;
}

export function upsertTeamMember(data: {
  name: string;
  position?: string | null;
  strengths?: string | null;
  weaknesses?: string | null;
  responsibilities?: string | null;
  active_projects?: string | null;
  notes?: string | null;
  aliases?: string | null;
  category?: string;
}): number {
  const existing = getTeamMemberByNameOrAlias(data.name);
  if (existing) {
    const updates: string[] = [];
    const values: any[] = [];
    if (data.position !== undefined) { updates.push("position = ?"); values.push(data.position); }
    if (data.strengths !== undefined) { updates.push("strengths = ?"); values.push(data.strengths); }
    if (data.weaknesses !== undefined) { updates.push("weaknesses = ?"); values.push(data.weaknesses); }
    if (data.responsibilities !== undefined) { updates.push("responsibilities = ?"); values.push(data.responsibilities); }
    if (data.active_projects !== undefined) { updates.push("active_projects = ?"); values.push(data.active_projects); }
    if (data.notes !== undefined) { updates.push("notes = ?"); values.push(data.notes); }
    if (data.aliases !== undefined) { updates.push("aliases = ?"); values.push(data.aliases); }
    if (data.category !== undefined) { updates.push("category = ?"); values.push(data.category); }
    if (updates.length > 0) {
      updates.push("updated_at = datetime('now')");
      values.push(existing.id);
      db.prepare(`UPDATE team_members SET ${updates.join(", ")} WHERE id = ?`).run(...values);
    }
    return existing.id;
  } else {
    const result = db.prepare(`
      INSERT INTO team_members (name, position, strengths, weaknesses, responsibilities, active_projects, notes, aliases, category)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(data.name, data.position || null, data.strengths || null, data.weaknesses || null, data.responsibilities || null, data.active_projects || null, data.notes || null, data.aliases || null, data.category || 'team');
    return result.lastInsertRowid as number;
  }
}

export function updateTeamMember(id: number, data: Partial<Omit<TeamMember, "id" | "created_at" | "updated_at">>) {
  const updates: string[] = [];
  const values: any[] = [];
  for (const [key, val] of Object.entries(data)) {
    updates.push(`${key} = ?`);
    values.push(val);
  }
  if (updates.length > 0) {
    updates.push("updated_at = datetime('now')");
    values.push(id);
    db.prepare(`UPDATE team_members SET ${updates.join(", ")} WHERE id = ?`).run(...values);
  }
}

export function deleteTeamMember(id: number) {
  db.prepare(`DELETE FROM team_members WHERE id = ?`).run(id);
}

// ==================== MEETINGS ====================
db.exec(`
  CREATE TABLE IF NOT EXISTS meetings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    date_time TEXT,
    participants TEXT,
    agenda TEXT,
    status TEXT NOT NULL DEFAULT 'scheduled' CHECK(status IN ('scheduled', 'completed', 'cancelled')),
    summary TEXT,
    decisions TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_meetings_date_time ON meetings(date_time);
  CREATE INDEX IF NOT EXISTS idx_meetings_status ON meetings(status);
`);

export interface Meeting {
  id: number;
  title: string;
  date_time: string | null;
  participants: string | null;
  agenda: string | null;
  status: string;
  summary: string | null;
  decisions: string | null;
  created_at: string;
  updated_at: string;
}

export function getMeetings(status?: string): Meeting[] {
  if (status) {
    return db.prepare(`SELECT * FROM meetings WHERE status = ? ORDER BY date_time DESC`).all(status) as Meeting[];
  }
  return db.prepare(`SELECT * FROM meetings ORDER BY date_time DESC`).all() as Meeting[];
}

export function getMeetingById(id: number): Meeting | undefined {
  return db.prepare(`SELECT * FROM meetings WHERE id = ?`).get(id) as Meeting | undefined;
}

export function getUpcomingMeetings(): Meeting[] {
  return db.prepare(`SELECT * FROM meetings WHERE status = 'scheduled' AND date_time >= datetime('now', '-1 hour') ORDER BY date_time ASC`).all() as Meeting[];
}

export function getTodayMeetings(): Meeting[] {
  return db.prepare(`SELECT * FROM meetings WHERE status = 'scheduled' AND date(date_time) = date('now') ORDER BY date_time ASC`).all() as Meeting[];
}

export function createMeeting(data: { title: string; date_time?: string | null; participants?: string | null; agenda?: string | null }): number {
  const result = db.prepare(`
    INSERT INTO meetings (title, date_time, participants, agenda) VALUES (?, ?, ?, ?)
  `).run(data.title, data.date_time || null, data.participants || null, data.agenda || null);
  return result.lastInsertRowid as number;
}

export function updateMeeting(id: number, data: Partial<Omit<Meeting, "id" | "created_at" | "updated_at">>) {
  const updates: string[] = [];
  const values: any[] = [];
  for (const [key, val] of Object.entries(data)) {
    updates.push(`${key} = ?`);
    values.push(val);
  }
  if (updates.length > 0) {
    updates.push("updated_at = datetime('now')");
    values.push(id);
    db.prepare(`UPDATE meetings SET ${updates.join(", ")} WHERE id = ?`).run(...values);
  }
}

export function deleteMeeting(id: number) {
  db.prepare(`DELETE FROM meetings WHERE id = ?`).run(id);
}

// ==================== ACTION ITEMS ====================
db.exec(`
  CREATE TABLE IF NOT EXISTS action_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    assignee TEXT,
    deadline TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'in_progress', 'completed', 'cancelled')),
    priority TEXT NOT NULL DEFAULT 'medium' CHECK(priority IN ('low', 'medium', 'high', 'urgent')),
    source TEXT,
    meeting_id INTEGER,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    completed_at TEXT,
    FOREIGN KEY (meeting_id) REFERENCES meetings(id)
  );
  CREATE INDEX IF NOT EXISTS idx_action_items_assignee ON action_items(assignee);
  CREATE INDEX IF NOT EXISTS idx_action_items_status ON action_items(status);
  CREATE INDEX IF NOT EXISTS idx_action_items_deadline ON action_items(deadline);
  CREATE INDEX IF NOT EXISTS idx_action_items_priority ON action_items(priority);
`);

export interface ActionItem {
  id: number;
  title: string;
  assignee: string | null;
  deadline: string | null;
  status: string;
  priority: string;
  source: string | null;
  meeting_id: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

export function getActionItems(filters?: { status?: string; assignee?: string }): ActionItem[] {
  let query = `SELECT * FROM action_items WHERE 1=1`;
  const params: any[] = [];
  if (filters?.status) { query += ` AND status = ?`; params.push(filters.status); }
  if (filters?.assignee) { query += ` AND LOWER(assignee) = LOWER(?)`; params.push(filters.assignee); }
  query += ` ORDER BY CASE priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 END, deadline ASC`;
  return db.prepare(query).all(...params) as ActionItem[];
}

export function getOverdueActionItems(): ActionItem[] {
  return db.prepare(`
    SELECT * FROM action_items 
    WHERE status IN ('pending', 'in_progress') AND deadline IS NOT NULL AND deadline < datetime('now')
    ORDER BY deadline ASC
  `).all() as ActionItem[];
}

export function getPendingActionItems(): ActionItem[] {
  return db.prepare(`
    SELECT * FROM action_items WHERE status IN ('pending', 'in_progress')
    ORDER BY CASE priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 END, deadline ASC
  `).all() as ActionItem[];
}

export function getActionItemById(id: number): ActionItem | undefined {
  return db.prepare(`SELECT * FROM action_items WHERE id = ?`).get(id) as ActionItem | undefined;
}

export function createActionItem(data: {
  title: string;
  assignee?: string | null;
  deadline?: string | null;
  priority?: string;
  source?: string | null;
  meeting_id?: number | null;
  notes?: string | null;
}): number {
  const result = db.prepare(`
    INSERT INTO action_items (title, assignee, deadline, priority, source, meeting_id, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(data.title, data.assignee || null, data.deadline || null, data.priority || "medium", data.source || null, data.meeting_id || null, data.notes || null);
  return result.lastInsertRowid as number;
}

export function updateActionItem(id: number, data: Partial<Omit<ActionItem, "id" | "created_at">>) {
  const updates: string[] = [];
  const values: any[] = [];
  for (const [key, val] of Object.entries(data)) {
    if (key === "updated_at") continue;
    updates.push(`${key} = ?`);
    values.push(val);
  }
  if (data.status === "completed" && !data.completed_at) {
    updates.push("completed_at = datetime('now')");
  }
  if (updates.length > 0) {
    updates.push("updated_at = datetime('now')");
    values.push(id);
    db.prepare(`UPDATE action_items SET ${updates.join(", ")} WHERE id = ?`).run(...values);
  }
}

export function deleteActionItem(id: number) {
  db.prepare(`DELETE FROM action_items WHERE id = ?`).run(id);
}

// ==================== PROJECTS ====================
db.exec(`
  CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    pic TEXT,
    status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('planning', 'active', 'on_hold', 'completed', 'cancelled')),
    milestones TEXT,
    deadline TEXT,
    progress INTEGER DEFAULT 0,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
  CREATE INDEX IF NOT EXISTS idx_projects_pic ON projects(pic);
`);

export interface Project {
  id: number;
  name: string;
  description: string | null;
  pic: string | null;
  status: string;
  milestones: string | null;
  deadline: string | null;
  progress: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export function getProjects(status?: string): Project[] {
  if (status) {
    return db.prepare(`SELECT * FROM projects WHERE status = ? ORDER BY updated_at DESC`).all(status) as Project[];
  }
  return db.prepare(`SELECT * FROM projects ORDER BY updated_at DESC`).all() as Project[];
}

export function getProjectById(id: number): Project | undefined {
  return db.prepare(`SELECT * FROM projects WHERE id = ?`).get(id) as Project | undefined;
}

export function getProjectByName(name: string): Project | undefined {
  return db.prepare(`SELECT * FROM projects WHERE LOWER(name) = LOWER(?)`).get(name) as Project | undefined;
}

export function upsertProject(data: {
  name: string;
  description?: string | null;
  pic?: string | null;
  status?: string;
  milestones?: string | null;
  deadline?: string | null;
  progress?: number;
  notes?: string | null;
}): number {
  const existing = getProjectByName(data.name);
  if (existing) {
    const updates: string[] = [];
    const values: any[] = [];
    if (data.description !== undefined) { updates.push("description = ?"); values.push(data.description); }
    if (data.pic !== undefined) { updates.push("pic = ?"); values.push(data.pic); }
    if (data.status !== undefined) { updates.push("status = ?"); values.push(data.status); }
    if (data.milestones !== undefined) { updates.push("milestones = ?"); values.push(data.milestones); }
    if (data.deadline !== undefined) { updates.push("deadline = ?"); values.push(data.deadline); }
    if (data.progress !== undefined) { updates.push("progress = ?"); values.push(data.progress); }
    if (data.notes !== undefined) { updates.push("notes = ?"); values.push(data.notes); }
    if (updates.length > 0) {
      updates.push("updated_at = datetime('now')");
      values.push(existing.id);
      db.prepare(`UPDATE projects SET ${updates.join(", ")} WHERE id = ?`).run(...values);
    }
    return existing.id;
  } else {
    const result = db.prepare(`
      INSERT INTO projects (name, description, pic, status, milestones, deadline, progress, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(data.name, data.description || null, data.pic || null, data.status || "active", data.milestones || null, data.deadline || null, data.progress || 0, data.notes || null);
    return result.lastInsertRowid as number;
  }
}

export function updateProject(id: number, data: Partial<Omit<Project, "id" | "created_at" | "updated_at">>) {
  const updates: string[] = [];
  const values: any[] = [];
  for (const [key, val] of Object.entries(data)) {
    updates.push(`${key} = ?`);
    values.push(val);
  }
  if (updates.length > 0) {
    updates.push("updated_at = datetime('now')");
    values.push(id);
    db.prepare(`UPDATE projects SET ${updates.join(", ")} WHERE id = ?`).run(...values);
  }
}

export function deleteProject(id: number) {
  db.prepare(`DELETE FROM projects WHERE id = ?`).run(id);
}

// ==================== NOTIFICATIONS ====================
db.exec(`
  CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    data TEXT,
    read INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);
  CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);
  CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);
`);

export interface Notification {
  id: number;
  type: string;
  title: string;
  message: string;
  data: string | null;
  read: number;
  created_at: string;
}

export function getNotifications(unreadOnly = false, limit = 50): Notification[] {
  if (unreadOnly) {
    return db.prepare(`SELECT * FROM notifications WHERE read = 0 ORDER BY created_at DESC LIMIT ?`).all(limit) as Notification[];
  }
  return db.prepare(`SELECT * FROM notifications ORDER BY created_at DESC LIMIT ?`).all(limit) as Notification[];
}

export function getUnreadNotificationCount(): number {
  const row = db.prepare(`SELECT COUNT(*) as count FROM notifications WHERE read = 0`).get() as { count: number };
  return row.count;
}

export function createNotification(data: { type: string; title: string; message: string; data?: string | null }): number {
  const result = db.prepare(`
    INSERT INTO notifications (type, title, message, data) VALUES (?, ?, ?, ?)
  `).run(data.type, data.title, data.message, data.data || null);
  return result.lastInsertRowid as number;
}

export function markNotificationRead(id: number) {
  db.prepare(`UPDATE notifications SET read = 1 WHERE id = ?`).run(id);
}

export function markAllNotificationsRead() {
  db.prepare(`UPDATE notifications SET read = 1 WHERE read = 0`).run();
}

export function deleteAllNotifications() {
  db.prepare(`DELETE FROM notifications`).run();
}

export function cleanupOldNotifications(hoursOld = 24) {
  db.prepare(`DELETE FROM notifications WHERE read = 1 AND created_at < datetime('now', '-' || ? || ' hours')`).run(hoursOld);
}

export function deleteNotification(id: number) {
  db.prepare(`DELETE FROM notifications WHERE id = ?`).run(id);
}

// ==================== PUSH SUBSCRIPTIONS ====================
db.exec(`
  CREATE TABLE IF NOT EXISTS push_subscriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    endpoint TEXT NOT NULL UNIQUE,
    keys_p256dh TEXT NOT NULL,
    keys_auth TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

export interface PushSubscription {
  id: number;
  endpoint: string;
  keys_p256dh: string;
  keys_auth: string;
  created_at: string;
}

export function savePushSubscription(sub: { endpoint: string; keys_p256dh: string; keys_auth: string }) {
  const existing = db.prepare(`SELECT id FROM push_subscriptions WHERE endpoint = ?`).get(sub.endpoint);
  if (existing) {
    db.prepare(`UPDATE push_subscriptions SET keys_p256dh = ?, keys_auth = ? WHERE endpoint = ?`).run(sub.keys_p256dh, sub.keys_auth, sub.endpoint);
  } else {
    db.prepare(`INSERT INTO push_subscriptions (endpoint, keys_p256dh, keys_auth) VALUES (?, ?, ?)`).run(sub.endpoint, sub.keys_p256dh, sub.keys_auth);
  }
}

export function getAllPushSubscriptions(): PushSubscription[] {
  return db.prepare(`SELECT * FROM push_subscriptions`).all() as PushSubscription[];
}

export function removePushSubscription(endpoint: string) {
  db.prepare(`DELETE FROM push_subscriptions WHERE endpoint = ?`).run(endpoint);
}

export default db;
