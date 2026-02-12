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

export default db;
