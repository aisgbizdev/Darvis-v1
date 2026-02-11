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
    target TEXT NOT NULL CHECK(target IN ('dr', 'broto', 'rara', 'rere')),
    feedback TEXT NOT NULL,
    sentiment TEXT NOT NULL DEFAULT 'neutral' CHECK(sentiment IN ('positive', 'negative', 'neutral', 'mixed')),
    confidence REAL NOT NULL DEFAULT 0.7,
    source_context TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_persona_feedback_target ON persona_feedback(target);
`);

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
  target: string;
  feedback: string;
  sentiment: string;
  confidence: number;
  source_context: string | null;
  created_at: string;
}

export function getPersonaFeedback(target?: string): PersonaFeedback[] {
  if (target) {
    return db.prepare(`SELECT * FROM persona_feedback WHERE target = ? ORDER BY confidence DESC, created_at DESC`).all(target) as PersonaFeedback[];
  }
  return db.prepare(`SELECT * FROM persona_feedback ORDER BY target, confidence DESC, created_at DESC`).all() as PersonaFeedback[];
}

export function savePersonaFeedback(
  target: string,
  feedback: string,
  sentiment: string,
  confidence: number,
  sourceContext: string | null
) {
  const existing = db.prepare(`
    SELECT id FROM persona_feedback WHERE target = ? AND feedback = ?
  `).get(target, feedback) as { id: number } | undefined;

  if (existing) {
    db.prepare(`
      UPDATE persona_feedback SET confidence = ?, sentiment = ?, source_context = ?, created_at = datetime('now') WHERE id = ?
    `).run(confidence, sentiment, sourceContext, existing.id);
  } else {
    db.prepare(`
      INSERT INTO persona_feedback (target, feedback, sentiment, confidence, source_context) VALUES (?, ?, ?, ?, ?)
    `).run(target, feedback, sentiment, confidence, sourceContext);
  }
}

export function bulkSavePersonaFeedback(
  items: { target: string; feedback: string; sentiment: string; confidence: number; source_context: string | null }[]
) {
  const transaction = db.transaction(() => {
    for (const item of items) {
      savePersonaFeedback(item.target, item.feedback, item.sentiment, item.confidence, item.source_context);
    }
  });
  transaction();
}

export function clearPersonaFeedback() {
  db.prepare(`DELETE FROM persona_feedback`).run();
}

export function getPreferenceCount(userId: string): number {
  const row = db.prepare(`SELECT COUNT(*) as count FROM learned_preferences WHERE user_id = ?`).get(userId) as { count: number };
  return row.count;
}

export default db;
