import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export async function initDatabase() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS conversations (
      id SERIAL PRIMARY KEY,
      user_id TEXT NOT NULL DEFAULT 'mas_dr',
      role TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
      content TEXT NOT NULL,
      room_id INTEGER,
      created_at TEXT NOT NULL DEFAULT (NOW()::TEXT)
    );

    CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON conversations(user_id);
    CREATE INDEX IF NOT EXISTS idx_conversations_created_at ON conversations(created_at);
    CREATE INDEX IF NOT EXISTS idx_conversations_room_id ON conversations(room_id);

    CREATE TABLE IF NOT EXISTS summaries (
      id SERIAL PRIMARY KEY,
      user_id TEXT NOT NULL DEFAULT 'mas_dr' UNIQUE,
      summary TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (NOW()::TEXT)
    );

    CREATE TABLE IF NOT EXISTS learned_preferences (
      id SERIAL PRIMARY KEY,
      user_id TEXT NOT NULL DEFAULT 'mas_dr',
      category TEXT NOT NULL,
      insight TEXT NOT NULL,
      confidence DOUBLE PRECISION NOT NULL DEFAULT 0.7,
      source_summary TEXT,
      created_at TEXT NOT NULL DEFAULT (NOW()::TEXT),
      updated_at TEXT NOT NULL DEFAULT (NOW()::TEXT)
    );

    CREATE INDEX IF NOT EXISTS idx_learned_prefs_user_id ON learned_preferences(user_id);
    CREATE INDEX IF NOT EXISTS idx_learned_prefs_category ON learned_preferences(category);

    CREATE TABLE IF NOT EXISTS persona_feedback (
      id SERIAL PRIMARY KEY,
      user_id TEXT NOT NULL DEFAULT 'mas_dr',
      target TEXT NOT NULL CHECK(target IN ('dr', 'broto', 'rara', 'rere')),
      feedback TEXT NOT NULL,
      sentiment TEXT NOT NULL DEFAULT 'neutral' CHECK(sentiment IN ('positive', 'negative', 'neutral', 'mixed')),
      confidence DOUBLE PRECISION NOT NULL DEFAULT 0.7,
      source_context TEXT,
      created_at TEXT NOT NULL DEFAULT (NOW()::TEXT)
    );

    CREATE INDEX IF NOT EXISTS idx_persona_feedback_target ON persona_feedback(target);
    CREATE INDEX IF NOT EXISTS idx_persona_feedback_user_id ON persona_feedback(user_id);

    CREATE TABLE IF NOT EXISTS profile_enrichments (
      id SERIAL PRIMARY KEY,
      user_id TEXT NOT NULL DEFAULT 'mas_dr',
      category TEXT NOT NULL,
      fact TEXT NOT NULL,
      confidence DOUBLE PRECISION NOT NULL DEFAULT 0.8,
      source_quote TEXT,
      created_at TEXT NOT NULL DEFAULT (NOW()::TEXT)
    );

    CREATE INDEX IF NOT EXISTS idx_profile_enrichments_category ON profile_enrichments(category);
    CREATE INDEX IF NOT EXISTS idx_profile_enrichments_user_id ON profile_enrichments(user_id);

    CREATE TABLE IF NOT EXISTS conversation_tags (
      id SERIAL PRIMARY KEY,
      user_id TEXT NOT NULL,
      context_mode TEXT NOT NULL DEFAULT 'general',
      decision_type TEXT,
      emotional_tone TEXT,
      nodes_active TEXT,
      strategic_escalation INTEGER NOT NULL DEFAULT 0,
      fast_decision INTEGER NOT NULL DEFAULT 0,
      multi_persona INTEGER NOT NULL DEFAULT 0,
      user_message_preview TEXT,
      created_at TEXT NOT NULL DEFAULT (NOW()::TEXT)
    );

    CREATE INDEX IF NOT EXISTS idx_conversation_tags_user_id ON conversation_tags(user_id);
    CREATE INDEX IF NOT EXISTS idx_conversation_tags_context_mode ON conversation_tags(context_mode);
    CREATE INDEX IF NOT EXISTS idx_conversation_tags_created_at ON conversation_tags(created_at);

    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (NOW()::TEXT)
    );

    CREATE TABLE IF NOT EXISTS team_members (
      id SERIAL PRIMARY KEY,
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
      work_style TEXT,
      communication_style TEXT,
      triggers TEXT,
      commitments TEXT,
      personality_notes TEXT,
      created_at TEXT NOT NULL DEFAULT (NOW()::TEXT),
      updated_at TEXT NOT NULL DEFAULT (NOW()::TEXT)
    );

    CREATE INDEX IF NOT EXISTS idx_team_members_name ON team_members(name);
    CREATE INDEX IF NOT EXISTS idx_team_members_status ON team_members(status);

    CREATE TABLE IF NOT EXISTS meetings (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      date_time TEXT,
      participants TEXT,
      agenda TEXT,
      status TEXT NOT NULL DEFAULT 'scheduled' CHECK(status IN ('scheduled', 'completed', 'cancelled')),
      summary TEXT,
      decisions TEXT,
      created_at TEXT NOT NULL DEFAULT (NOW()::TEXT),
      updated_at TEXT NOT NULL DEFAULT (NOW()::TEXT)
    );

    CREATE INDEX IF NOT EXISTS idx_meetings_date_time ON meetings(date_time);
    CREATE INDEX IF NOT EXISTS idx_meetings_status ON meetings(status);

    CREATE TABLE IF NOT EXISTS action_items (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      assignee TEXT,
      deadline TEXT,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'in_progress', 'completed', 'cancelled')),
      priority TEXT NOT NULL DEFAULT 'medium' CHECK(priority IN ('low', 'medium', 'high', 'urgent')),
      source TEXT,
      meeting_id INTEGER,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (NOW()::TEXT),
      updated_at TEXT NOT NULL DEFAULT (NOW()::TEXT),
      completed_at TEXT,
      FOREIGN KEY (meeting_id) REFERENCES meetings(id)
    );

    CREATE INDEX IF NOT EXISTS idx_action_items_assignee ON action_items(assignee);
    CREATE INDEX IF NOT EXISTS idx_action_items_status ON action_items(status);
    CREATE INDEX IF NOT EXISTS idx_action_items_deadline ON action_items(deadline);
    CREATE INDEX IF NOT EXISTS idx_action_items_priority ON action_items(priority);

    CREATE TABLE IF NOT EXISTS projects (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      pic TEXT,
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('planning', 'active', 'on_hold', 'completed', 'cancelled')),
      milestones TEXT,
      deadline TEXT,
      progress INTEGER DEFAULT 0,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (NOW()::TEXT),
      updated_at TEXT NOT NULL DEFAULT (NOW()::TEXT)
    );

    CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
    CREATE INDEX IF NOT EXISTS idx_projects_pic ON projects(pic);

    CREATE TABLE IF NOT EXISTS notifications (
      id SERIAL PRIMARY KEY,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      data TEXT,
      read INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (NOW()::TEXT)
    );

    CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);
    CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);
    CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);

    CREATE TABLE IF NOT EXISTS push_subscriptions (
      id SERIAL PRIMARY KEY,
      endpoint TEXT NOT NULL UNIQUE,
      keys_p256dh TEXT NOT NULL,
      keys_auth TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (NOW()::TEXT)
    );

    CREATE TABLE IF NOT EXISTS chat_rooms (
      id SERIAL PRIMARY KEY,
      session_id TEXT NOT NULL,
      title TEXT NOT NULL DEFAULT 'Obrolan Baru',
      created_at TEXT NOT NULL DEFAULT (NOW()::TEXT),
      updated_at TEXT NOT NULL DEFAULT (NOW()::TEXT)
    );

    CREATE INDEX IF NOT EXISTS idx_chat_rooms_session_id ON chat_rooms(session_id);
    CREATE INDEX IF NOT EXISTS idx_chat_rooms_updated_at ON chat_rooms(updated_at);
  `);

  const migrations = [
    `ALTER TABLE persona_feedback ADD COLUMN IF NOT EXISTS user_id TEXT NOT NULL DEFAULT 'mas_dr'`,
    `ALTER TABLE profile_enrichments ADD COLUMN IF NOT EXISTS user_id TEXT NOT NULL DEFAULT 'mas_dr'`,
    `ALTER TABLE team_members ADD COLUMN IF NOT EXISTS aliases TEXT`,
    `ALTER TABLE team_members ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'team'`,
    `ALTER TABLE team_members ADD COLUMN IF NOT EXISTS work_style TEXT`,
    `ALTER TABLE team_members ADD COLUMN IF NOT EXISTS communication_style TEXT`,
    `ALTER TABLE team_members ADD COLUMN IF NOT EXISTS triggers TEXT`,
    `ALTER TABLE team_members ADD COLUMN IF NOT EXISTS commitments TEXT`,
    `ALTER TABLE team_members ADD COLUMN IF NOT EXISTS personality_notes TEXT`,
    `ALTER TABLE conversations ADD COLUMN IF NOT EXISTS room_id INTEGER`,
    `ALTER TABLE profile_enrichments ADD COLUMN IF NOT EXISTS contributor_name TEXT`,
  ];

  for (const migration of migrations) {
    try {
      await pool.query(migration);
    } catch (_e) {}
  }

  console.log("PostgreSQL database initialized successfully");
}

export async function getLastMessages(userId: string, limit: number = 10) {
  const result = await pool.query(
    `SELECT role, content FROM conversations WHERE user_id = $1 ORDER BY id DESC LIMIT $2`,
    [userId, limit]
  );
  return (result.rows as { role: string; content: string }[]).reverse();
}

export async function getSummary(userId: string): Promise<string | null> {
  const result = await pool.query(
    `SELECT summary FROM summaries WHERE user_id = $1`,
    [userId]
  );
  const row = result.rows[0] as { summary: string } | undefined;
  return row?.summary || null;
}

export async function saveMessage(userId: string, role: "user" | "assistant", content: string) {
  await pool.query(
    `INSERT INTO conversations (user_id, role, content) VALUES ($1, $2, $3)`,
    [userId, role, content]
  );
}

export async function getMessageCount(userId: string): Promise<number> {
  const result = await pool.query(
    `SELECT COUNT(*) as count FROM conversations WHERE user_id = $1`,
    [userId]
  );
  return parseInt(result.rows[0].count, 10);
}

export async function upsertSummary(userId: string, summary: string) {
  await pool.query(
    `INSERT INTO summaries (user_id, summary, updated_at) VALUES ($1, $2, NOW()::TEXT)
     ON CONFLICT(user_id) DO UPDATE SET summary = EXCLUDED.summary, updated_at = NOW()::TEXT`,
    [userId, summary]
  );
}

export async function clearHistory(userId: string) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`DELETE FROM conversations WHERE user_id = $1`, [userId]);
    await client.query(`DELETE FROM summaries WHERE user_id = $1`, [userId]);
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

export async function getAllMessages(userId: string) {
  const result = await pool.query(
    `SELECT role, content FROM conversations WHERE user_id = $1 ORDER BY id ASC`,
    [userId]
  );
  return result.rows as { role: string; content: string }[];
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

export async function getLearnedPreferences(userId: string): Promise<LearnedPreference[]> {
  const result = await pool.query(
    `SELECT * FROM learned_preferences WHERE user_id = $1 ORDER BY confidence DESC, updated_at DESC`,
    [userId]
  );
  return result.rows as LearnedPreference[];
}

export async function upsertPreference(
  userId: string,
  category: string,
  insight: string,
  confidence: number,
  sourceSummary: string | null,
  client?: any
) {
  const q = client || pool;
  const existingResult = await q.query(
    `SELECT id FROM learned_preferences WHERE user_id = $1 AND category = $2 AND insight = $3`,
    [userId, category, insight]
  );
  const existing = existingResult.rows[0] as { id: number } | undefined;

  if (existing) {
    await q.query(
      `UPDATE learned_preferences SET confidence = $1, source_summary = $2, updated_at = NOW()::TEXT WHERE id = $3`,
      [confidence, sourceSummary, existing.id]
    );
  } else {
    await q.query(
      `INSERT INTO learned_preferences (user_id, category, insight, confidence, source_summary) VALUES ($1, $2, $3, $4, $5)`,
      [userId, category, insight, confidence, sourceSummary]
    );
  }
}

export async function bulkUpsertPreferences(
  userId: string,
  preferences: { category: string; insight: string; confidence: number; source_summary: string | null }[]
) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const pref of preferences) {
      await upsertPreference(userId, pref.category, pref.insight, pref.confidence, pref.source_summary, client);
    }
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

export async function clearPreferences(userId: string) {
  await pool.query(`DELETE FROM learned_preferences WHERE user_id = $1`, [userId]);
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

export async function getPersonaFeedback(userId: string, target?: string): Promise<PersonaFeedback[]> {
  if (target) {
    const result = await pool.query(
      `SELECT * FROM persona_feedback WHERE user_id = $1 AND target = $2 ORDER BY confidence DESC, created_at DESC`,
      [userId, target]
    );
    return result.rows as PersonaFeedback[];
  }
  const result = await pool.query(
    `SELECT * FROM persona_feedback WHERE user_id = $1 ORDER BY target, confidence DESC, created_at DESC`,
    [userId]
  );
  return result.rows as PersonaFeedback[];
}

export async function savePersonaFeedback(
  userId: string,
  target: string,
  feedback: string,
  sentiment: string,
  confidence: number,
  sourceContext: string | null,
  client?: any
) {
  const q = client || pool;
  const existingResult = await q.query(
    `SELECT id FROM persona_feedback WHERE user_id = $1 AND target = $2 AND feedback = $3`,
    [userId, target, feedback]
  );
  const existing = existingResult.rows[0] as { id: number } | undefined;

  if (existing) {
    await q.query(
      `UPDATE persona_feedback SET confidence = $1, sentiment = $2, source_context = $3, created_at = NOW()::TEXT WHERE id = $4`,
      [confidence, sentiment, sourceContext, existing.id]
    );
  } else {
    await q.query(
      `INSERT INTO persona_feedback (user_id, target, feedback, sentiment, confidence, source_context) VALUES ($1, $2, $3, $4, $5, $6)`,
      [userId, target, feedback, sentiment, confidence, sourceContext]
    );
  }
}

export async function bulkSavePersonaFeedback(
  userId: string,
  items: { target: string; feedback: string; sentiment: string; confidence: number; source_context: string | null }[]
) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const item of items) {
      await savePersonaFeedback(userId, item.target, item.feedback, item.sentiment, item.confidence, item.source_context, client);
    }
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

export async function clearPersonaFeedback(userId: string) {
  await pool.query(`DELETE FROM persona_feedback WHERE user_id = $1`, [userId]);
}

export async function getPreferenceCount(userId: string): Promise<number> {
  const result = await pool.query(
    `SELECT COUNT(*) as count FROM learned_preferences WHERE user_id = $1`,
    [userId]
  );
  return parseInt(result.rows[0].count, 10);
}

export interface ProfileEnrichment {
  id: number;
  user_id: string;
  category: string;
  fact: string;
  confidence: number;
  source_quote: string | null;
  contributor_name: string | null;
  created_at: string;
}

export async function getProfileEnrichments(userId: string): Promise<ProfileEnrichment[]> {
  const result = await pool.query(
    `SELECT * FROM profile_enrichments WHERE user_id = $1 ORDER BY category, confidence DESC, created_at DESC`,
    [userId]
  );
  return result.rows as ProfileEnrichment[];
}

export async function saveProfileEnrichment(
  userId: string,
  category: string,
  fact: string,
  confidence: number,
  sourceQuote: string | null,
  client?: any,
  contributorName?: string | null
) {
  const q = client || pool;
  const existingResult = await q.query(
    `SELECT id FROM profile_enrichments WHERE user_id = $1 AND category = $2 AND fact = $3`,
    [userId, category, fact]
  );
  const existing = existingResult.rows[0] as { id: number } | undefined;

  if (existing) {
    await q.query(
      `UPDATE profile_enrichments SET confidence = $1, source_quote = $2, created_at = NOW()::TEXT WHERE id = $3`,
      [confidence, sourceQuote, existing.id]
    );
  } else {
    await q.query(
      `INSERT INTO profile_enrichments (user_id, category, fact, confidence, source_quote, contributor_name) VALUES ($1, $2, $3, $4, $5, $6)`,
      [userId, category, fact, confidence, sourceQuote, contributorName || null]
    );
  }
}

export async function bulkSaveProfileEnrichments(
  userId: string,
  items: { category: string; fact: string; confidence: number; source_quote: string | null }[],
  contributorName?: string | null
) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const item of items) {
      await saveProfileEnrichment(userId, item.category, item.fact, item.confidence, item.source_quote, client, contributorName);
    }
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

export async function deleteProfileEnrichment(id: number) {
  await pool.query(`DELETE FROM profile_enrichments WHERE id = $1`, [id]);
}

export async function clearProfileEnrichments(userId: string) {
  await pool.query(`DELETE FROM profile_enrichments WHERE user_id = $1`, [userId]);
}

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

export async function saveConversationTag(
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
  await pool.query(
    `INSERT INTO conversation_tags (user_id, context_mode, decision_type, emotional_tone, nodes_active, strategic_escalation, fast_decision, multi_persona, user_message_preview)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      userId,
      tag.context_mode,
      tag.decision_type || null,
      tag.emotional_tone || null,
      tag.nodes_active || null,
      tag.strategic_escalation ? 1 : 0,
      tag.fast_decision ? 1 : 0,
      tag.multi_persona ? 1 : 0,
      tag.user_message_preview || null,
    ]
  );
}

export async function getConversationTags(userId: string, limit: number = 50): Promise<ConversationTag[]> {
  const result = await pool.query(
    `SELECT * FROM conversation_tags WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2`,
    [userId, limit]
  );
  return result.rows as ConversationTag[];
}

export async function clearConversationTags(userId: string) {
  await pool.query(`DELETE FROM conversation_tags WHERE user_id = $1`, [userId]);
}

export async function getSetting(key: string): Promise<string | null> {
  const result = await pool.query(
    `SELECT value FROM app_settings WHERE key = $1`,
    [key]
  );
  const row = result.rows[0] as { value: string } | undefined;
  return row?.value || null;
}

export async function setSetting(key: string, value: string) {
  await pool.query(
    `INSERT INTO app_settings (key, value, updated_at) VALUES ($1, $2, NOW()::TEXT)
     ON CONFLICT(key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()::TEXT`,
    [key, value]
  );
}

export async function getPassword(type: "owner" | "contributor"): Promise<string | null> {
  const dbVal = await getSetting(`${type}_password`);
  if (dbVal) return dbVal;
  if (type === "owner") return process.env.OWNER_PASSWORD || null;
  if (type === "contributor") return process.env.CONTRIBUTOR_PASSWORD || null;
  return null;
}

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
  work_style: string | null;
  communication_style: string | null;
  triggers: string | null;
  commitments: string | null;
  personality_notes: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export async function getTeamMembers(status?: string): Promise<TeamMember[]> {
  if (status) {
    const result = await pool.query(
      `SELECT * FROM team_members WHERE status = $1 ORDER BY name`,
      [status]
    );
    return result.rows as TeamMember[];
  }
  const result = await pool.query(`SELECT * FROM team_members ORDER BY name`);
  return result.rows as TeamMember[];
}

export async function getTeamMemberByName(name: string): Promise<TeamMember | undefined> {
  const result = await pool.query(
    `SELECT * FROM team_members WHERE LOWER(name) = LOWER($1)`,
    [name]
  );
  return result.rows[0] as TeamMember | undefined;
}

export async function getTeamMemberByNameOrAlias(name: string): Promise<TeamMember | undefined> {
  const trimmed = name.trim();
  if (!trimmed) return undefined;
  const byNameResult = await pool.query(
    `SELECT * FROM team_members WHERE LOWER(TRIM(name)) = LOWER($1)`,
    [trimmed]
  );
  const byName = byNameResult.rows[0] as TeamMember | undefined;
  if (byName) return byName;
  const allResult = await pool.query(
    `SELECT * FROM team_members WHERE aliases IS NOT NULL AND aliases != ''`
  );
  const allMembers = allResult.rows as TeamMember[];
  const lowerName = trimmed.toLowerCase();
  for (const m of allMembers) {
    if (m.aliases) {
      const aliasList = m.aliases.split(",").map(a => a.trim().toLowerCase());
      if (aliasList.includes(lowerName)) return m;
    }
  }
  return undefined;
}

export async function getTeamMemberById(id: number): Promise<TeamMember | undefined> {
  const result = await pool.query(
    `SELECT * FROM team_members WHERE id = $1`,
    [id]
  );
  return result.rows[0] as TeamMember | undefined;
}

export async function upsertTeamMember(data: {
  name: string;
  position?: string | null;
  strengths?: string | null;
  weaknesses?: string | null;
  responsibilities?: string | null;
  active_projects?: string | null;
  notes?: string | null;
  aliases?: string | null;
  category?: string;
  work_style?: string | null;
  communication_style?: string | null;
  triggers?: string | null;
  commitments?: string | null;
  personality_notes?: string | null;
}): Promise<number> {
  const existing = await getTeamMemberByNameOrAlias(data.name);
  if (existing) {
    const updates: string[] = [];
    const values: any[] = [];
    let paramIdx = 1;
    if (data.position !== undefined) { updates.push(`position = $${paramIdx++}`); values.push(data.position); }
    if (data.strengths !== undefined) { updates.push(`strengths = $${paramIdx++}`); values.push(data.strengths); }
    if (data.weaknesses !== undefined) { updates.push(`weaknesses = $${paramIdx++}`); values.push(data.weaknesses); }
    if (data.responsibilities !== undefined) { updates.push(`responsibilities = $${paramIdx++}`); values.push(data.responsibilities); }
    if (data.active_projects !== undefined) { updates.push(`active_projects = $${paramIdx++}`); values.push(data.active_projects); }
    if (data.notes !== undefined) { updates.push(`notes = $${paramIdx++}`); values.push(data.notes); }
    if (data.aliases !== undefined) { updates.push(`aliases = $${paramIdx++}`); values.push(data.aliases); }
    if (data.category !== undefined) { updates.push(`category = $${paramIdx++}`); values.push(data.category); }
    if (data.work_style !== undefined) { updates.push(`work_style = $${paramIdx++}`); values.push(data.work_style); }
    if (data.communication_style !== undefined) { updates.push(`communication_style = $${paramIdx++}`); values.push(data.communication_style); }
    if (data.triggers !== undefined) { updates.push(`triggers = $${paramIdx++}`); values.push(data.triggers); }
    if (data.commitments !== undefined) { updates.push(`commitments = $${paramIdx++}`); values.push(data.commitments); }
    if (data.personality_notes !== undefined) { updates.push(`personality_notes = $${paramIdx++}`); values.push(data.personality_notes); }
    if (updates.length > 0) {
      updates.push(`updated_at = NOW()::TEXT`);
      values.push(existing.id);
      await pool.query(
        `UPDATE team_members SET ${updates.join(", ")} WHERE id = $${paramIdx}`,
        values
      );
    }
    return existing.id;
  } else {
    const result = await pool.query(
      `INSERT INTO team_members (name, position, strengths, weaknesses, responsibilities, active_projects, notes, aliases, category, work_style, communication_style, triggers, commitments, personality_notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) RETURNING id`,
      [data.name, data.position || null, data.strengths || null, data.weaknesses || null, data.responsibilities || null, data.active_projects || null, data.notes || null, data.aliases || null, data.category || 'team', data.work_style || null, data.communication_style || null, data.triggers || null, data.commitments || null, data.personality_notes || null]
    );
    return result.rows[0].id as number;
  }
}

export async function updateTeamMember(id: number, data: Partial<Omit<TeamMember, "id" | "created_at" | "updated_at">>) {
  const updates: string[] = [];
  const values: any[] = [];
  let paramIdx = 1;
  for (const [key, val] of Object.entries(data)) {
    updates.push(`${key} = $${paramIdx++}`);
    values.push(val);
  }
  if (updates.length > 0) {
    updates.push(`updated_at = NOW()::TEXT`);
    values.push(id);
    await pool.query(
      `UPDATE team_members SET ${updates.join(", ")} WHERE id = $${paramIdx}`,
      values
    );
  }
}

export async function deleteTeamMember(id: number) {
  await pool.query(`DELETE FROM team_members WHERE id = $1`, [id]);
}

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

export async function getMeetings(status?: string): Promise<Meeting[]> {
  if (status) {
    const result = await pool.query(
      `SELECT * FROM meetings WHERE status = $1 ORDER BY date_time DESC`,
      [status]
    );
    return result.rows as Meeting[];
  }
  const result = await pool.query(`SELECT * FROM meetings ORDER BY date_time DESC`);
  return result.rows as Meeting[];
}

export async function getMeetingById(id: number): Promise<Meeting | undefined> {
  const result = await pool.query(`SELECT * FROM meetings WHERE id = $1`, [id]);
  return result.rows[0] as Meeting | undefined;
}

export async function getUpcomingMeetings(): Promise<Meeting[]> {
  const result = await pool.query(
    `SELECT * FROM meetings WHERE status = 'scheduled' AND date_time >= (NOW() - INTERVAL '1 hour')::TEXT ORDER BY date_time ASC`
  );
  return result.rows as Meeting[];
}

export async function getTodayMeetings(): Promise<Meeting[]> {
  const result = await pool.query(
    `SELECT * FROM meetings WHERE status = 'scheduled' AND DATE(date_time::TIMESTAMP) = CURRENT_DATE ORDER BY date_time ASC`
  );
  return result.rows as Meeting[];
}

export async function createMeeting(data: { title: string; date_time?: string | null; participants?: string | null; agenda?: string | null }): Promise<number> {
  const result = await pool.query(
    `INSERT INTO meetings (title, date_time, participants, agenda) VALUES ($1, $2, $3, $4) RETURNING id`,
    [data.title, data.date_time || null, data.participants || null, data.agenda || null]
  );
  return result.rows[0].id as number;
}

export async function updateMeeting(id: number, data: Partial<Omit<Meeting, "id" | "created_at" | "updated_at">>) {
  const updates: string[] = [];
  const values: any[] = [];
  let paramIdx = 1;
  for (const [key, val] of Object.entries(data)) {
    updates.push(`${key} = $${paramIdx++}`);
    values.push(val);
  }
  if (updates.length > 0) {
    updates.push(`updated_at = NOW()::TEXT`);
    values.push(id);
    await pool.query(
      `UPDATE meetings SET ${updates.join(", ")} WHERE id = $${paramIdx}`,
      values
    );
  }
}

export async function deleteMeeting(id: number) {
  await pool.query(`DELETE FROM meetings WHERE id = $1`, [id]);
}

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

export async function getActionItems(filters?: { status?: string; assignee?: string }): Promise<ActionItem[]> {
  let query = `SELECT * FROM action_items WHERE 1=1`;
  const params: any[] = [];
  let paramIdx = 1;
  if (filters?.status) { query += ` AND status = $${paramIdx++}`; params.push(filters.status); }
  if (filters?.assignee) { query += ` AND LOWER(assignee) = LOWER($${paramIdx++})`; params.push(filters.assignee); }
  query += ` ORDER BY CASE priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 END, deadline ASC`;
  const result = await pool.query(query, params);
  return result.rows as ActionItem[];
}

export async function getOverdueActionItems(): Promise<ActionItem[]> {
  const result = await pool.query(
    `SELECT * FROM action_items WHERE status IN ('pending', 'in_progress') AND deadline IS NOT NULL AND deadline < NOW()::TEXT ORDER BY deadline ASC`
  );
  return result.rows as ActionItem[];
}

export async function getPendingActionItems(): Promise<ActionItem[]> {
  const result = await pool.query(
    `SELECT * FROM action_items WHERE status IN ('pending', 'in_progress')
     ORDER BY CASE priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 END, deadline ASC`
  );
  return result.rows as ActionItem[];
}

export async function getActionItemById(id: number): Promise<ActionItem | undefined> {
  const result = await pool.query(`SELECT * FROM action_items WHERE id = $1`, [id]);
  return result.rows[0] as ActionItem | undefined;
}

export async function createActionItem(data: {
  title: string;
  assignee?: string | null;
  deadline?: string | null;
  priority?: string;
  source?: string | null;
  meeting_id?: number | null;
  notes?: string | null;
}): Promise<number> {
  const result = await pool.query(
    `INSERT INTO action_items (title, assignee, deadline, priority, source, meeting_id, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
    [data.title, data.assignee || null, data.deadline || null, data.priority || "medium", data.source || null, data.meeting_id || null, data.notes || null]
  );
  return result.rows[0].id as number;
}

export async function updateActionItem(id: number, data: Partial<Omit<ActionItem, "id" | "created_at">>) {
  const updates: string[] = [];
  const values: any[] = [];
  let paramIdx = 1;
  for (const [key, val] of Object.entries(data)) {
    if (key === "updated_at") continue;
    updates.push(`${key} = $${paramIdx++}`);
    values.push(val);
  }
  if (data.status === "completed" && !data.completed_at) {
    updates.push(`completed_at = NOW()::TEXT`);
  }
  if (updates.length > 0) {
    updates.push(`updated_at = NOW()::TEXT`);
    values.push(id);
    await pool.query(
      `UPDATE action_items SET ${updates.join(", ")} WHERE id = $${paramIdx}`,
      values
    );
  }
}

export async function deleteActionItem(id: number) {
  await pool.query(`DELETE FROM action_items WHERE id = $1`, [id]);
}

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

export async function getProjects(status?: string): Promise<Project[]> {
  if (status) {
    const result = await pool.query(
      `SELECT * FROM projects WHERE status = $1 ORDER BY updated_at DESC`,
      [status]
    );
    return result.rows as Project[];
  }
  const result = await pool.query(`SELECT * FROM projects ORDER BY updated_at DESC`);
  return result.rows as Project[];
}

export async function getProjectById(id: number): Promise<Project | undefined> {
  const result = await pool.query(`SELECT * FROM projects WHERE id = $1`, [id]);
  return result.rows[0] as Project | undefined;
}

export async function getProjectByName(name: string): Promise<Project | undefined> {
  const result = await pool.query(
    `SELECT * FROM projects WHERE LOWER(name) = LOWER($1)`,
    [name]
  );
  return result.rows[0] as Project | undefined;
}

export async function upsertProject(data: {
  name: string;
  description?: string | null;
  pic?: string | null;
  status?: string;
  milestones?: string | null;
  deadline?: string | null;
  progress?: number;
  notes?: string | null;
}): Promise<number> {
  const existing = await getProjectByName(data.name);
  if (existing) {
    const updates: string[] = [];
    const values: any[] = [];
    let paramIdx = 1;
    if (data.description !== undefined) { updates.push(`description = $${paramIdx++}`); values.push(data.description); }
    if (data.pic !== undefined) { updates.push(`pic = $${paramIdx++}`); values.push(data.pic); }
    if (data.status !== undefined) { updates.push(`status = $${paramIdx++}`); values.push(data.status); }
    if (data.milestones !== undefined) { updates.push(`milestones = $${paramIdx++}`); values.push(data.milestones); }
    if (data.deadline !== undefined) { updates.push(`deadline = $${paramIdx++}`); values.push(data.deadline); }
    if (data.progress !== undefined) { updates.push(`progress = $${paramIdx++}`); values.push(data.progress); }
    if (data.notes !== undefined) { updates.push(`notes = $${paramIdx++}`); values.push(data.notes); }
    if (updates.length > 0) {
      updates.push(`updated_at = NOW()::TEXT`);
      values.push(existing.id);
      await pool.query(
        `UPDATE projects SET ${updates.join(", ")} WHERE id = $${paramIdx}`,
        values
      );
    }
    return existing.id;
  } else {
    const result = await pool.query(
      `INSERT INTO projects (name, description, pic, status, milestones, deadline, progress, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
      [data.name, data.description || null, data.pic || null, data.status || "active", data.milestones || null, data.deadline || null, data.progress || 0, data.notes || null]
    );
    return result.rows[0].id as number;
  }
}

export async function updateProject(id: number, data: Partial<Omit<Project, "id" | "created_at" | "updated_at">>) {
  const updates: string[] = [];
  const values: any[] = [];
  let paramIdx = 1;
  for (const [key, val] of Object.entries(data)) {
    updates.push(`${key} = $${paramIdx++}`);
    values.push(val);
  }
  if (updates.length > 0) {
    updates.push(`updated_at = NOW()::TEXT`);
    values.push(id);
    await pool.query(
      `UPDATE projects SET ${updates.join(", ")} WHERE id = $${paramIdx}`,
      values
    );
  }
}

export async function deleteProject(id: number) {
  await pool.query(`DELETE FROM projects WHERE id = $1`, [id]);
}

export interface Notification {
  id: number;
  type: string;
  title: string;
  message: string;
  data: string | null;
  read: number;
  created_at: string;
}

export async function getNotifications(unreadOnly = false, limit = 50): Promise<Notification[]> {
  if (unreadOnly) {
    const result = await pool.query(
      `SELECT * FROM notifications WHERE read = 0 ORDER BY created_at DESC LIMIT $1`,
      [limit]
    );
    return result.rows as Notification[];
  }
  const result = await pool.query(
    `SELECT * FROM notifications ORDER BY created_at DESC LIMIT $1`,
    [limit]
  );
  return result.rows as Notification[];
}

export async function getUnreadNotificationCount(): Promise<number> {
  const result = await pool.query(`SELECT COUNT(*) as count FROM notifications WHERE read = 0`);
  return parseInt(result.rows[0].count, 10);
}

export async function createNotification(data: { type: string; title: string; message: string; data?: string | null }): Promise<number> {
  const result = await pool.query(
    `INSERT INTO notifications (type, title, message, data) VALUES ($1, $2, $3, $4) RETURNING id`,
    [data.type, data.title, data.message, data.data || null]
  );
  return result.rows[0].id as number;
}

export async function markNotificationRead(id: number) {
  await pool.query(`UPDATE notifications SET read = 1 WHERE id = $1`, [id]);
}

export async function markAllNotificationsRead() {
  await pool.query(`UPDATE notifications SET read = 1 WHERE read = 0`);
}

export async function deleteAllNotifications() {
  await pool.query(`DELETE FROM notifications`);
}

export async function cleanupOldNotifications(hoursOld = 24) {
  await pool.query(
    `DELETE FROM notifications WHERE read = 1 AND created_at::TIMESTAMP < NOW() - INTERVAL '1 hour' * $1`,
    [hoursOld]
  );
}

export async function deleteNotification(id: number) {
  await pool.query(`DELETE FROM notifications WHERE id = $1`, [id]);
}

export interface PushSubscription {
  id: number;
  endpoint: string;
  keys_p256dh: string;
  keys_auth: string;
  created_at: string;
}

export async function savePushSubscription(sub: { endpoint: string; keys_p256dh: string; keys_auth: string }) {
  const existingResult = await pool.query(
    `SELECT id FROM push_subscriptions WHERE endpoint = $1`,
    [sub.endpoint]
  );
  if (existingResult.rows[0]) {
    await pool.query(
      `UPDATE push_subscriptions SET keys_p256dh = $1, keys_auth = $2 WHERE endpoint = $3`,
      [sub.keys_p256dh, sub.keys_auth, sub.endpoint]
    );
  } else {
    await pool.query(
      `INSERT INTO push_subscriptions (endpoint, keys_p256dh, keys_auth) VALUES ($1, $2, $3)`,
      [sub.endpoint, sub.keys_p256dh, sub.keys_auth]
    );
  }
}

export async function getAllPushSubscriptions(): Promise<PushSubscription[]> {
  const result = await pool.query(`SELECT * FROM push_subscriptions`);
  return result.rows as PushSubscription[];
}

export async function removePushSubscription(endpoint: string) {
  await pool.query(`DELETE FROM push_subscriptions WHERE endpoint = $1`, [endpoint]);
}

export async function seedDRProfileForUser(userId: string) {
  const countResult = await pool.query(
    `SELECT COUNT(*) as cnt FROM profile_enrichments WHERE user_id = $1`,
    [userId]
  );
  const existingCount = parseInt(countResult.rows[0].cnt, 10);
  if (existingCount > 0) {
    return;
  }

  const seedItems: { category: string; fact: string; confidence: number }[] = [];

  seedItems.push({ category: "identitas_profesional", fact: "CBD (Chief Business Developer) Solid Group, langsung di bawah owner", confidence: 1.0 });
  seedItems.push({ category: "identitas_profesional", fact: "Mengelola 5 PT: RFB, EWF, KPF, BPF, SGB", confidence: 1.0 });
  seedItems.push({ category: "identitas_profesional", fact: "Memimpin divisi BD sebagai engine strategis SG", confidence: 1.0 });
  seedItems.push({ category: "identitas_profesional", fact: "Usia: 51 tahun (lahir 11 Agustus)", confidence: 1.0 });

  seedItems.push({ category: "gaya_berpikir", fact: "Polymath & modular thinker — paham lintas bidang, ambil kelebihan parsial dari berbagai sumber, racik jadi framework sendiri", confidence: 1.0 });
  seedItems.push({ category: "gaya_berpikir", fact: "Multimode: makro-strategis, teknis-detail, kreatif, humanistik — bisa pindah mode dalam satu percakapan", confidence: 1.0 });
  seedItems.push({ category: "gaya_berpikir", fact: "Berpikir sistemik: selalu lihat gambaran besar dan koneksi antar bagian", confidence: 1.0 });
  seedItems.push({ category: "gaya_berpikir", fact: "Visioner tapi detail-oriented, tegas tapi peduli tim", confidence: 1.0 });
  seedItems.push({ category: "gaya_berpikir", fact: "High expectation, fast-paced, naluri psikologis kuat", confidence: 1.0 });
  seedItems.push({ category: "gaya_berpikir", fact: "Suka di-challenge habis-habisan, bukan di-iya-in", confidence: 1.0 });

  seedItems.push({ category: "gaya_komunikasi", fact: "Santai, to the point, kadang gaul, tegas kalau konteks berat", confidence: 1.0 });
  seedItems.push({ category: "gaya_komunikasi", fact: "Fleksibel: formal saat kerja, santai saat curhat", confidence: 1.0 });
  seedItems.push({ category: "gaya_komunikasi", fact: "Suka sparring intelektual — butuh partner yang menantang dan berani beda pendapat", confidence: 1.0 });
  seedItems.push({ category: "gaya_komunikasi", fact: "Sering pakai analogi dari film, buku, dan tokoh untuk jelaskan konsep", confidence: 1.0 });

  seedItems.push({ category: "kekuatan", fact: "Sistemik, eksekutor cepat, struktural-rapi, berani hadapi fakta, open to tech, tahan tekanan, empatik realistis, polymath, adaptif, baca orang cepat", confidence: 1.0 });

  seedItems.push({ category: "area_perhatian", fact: "Terlalu banyak proyek jalan bersamaan — energi kepecah, mental load tinggi", confidence: 1.0 });
  seedItems.push({ category: "area_perhatian", fact: "Perfeksionis sistem bisa tunda implementasi", confidence: 1.0 });
  seedItems.push({ category: "area_perhatian", fact: "Cenderung micromanage di beberapa titik — perlu latih trust & delegation", confidence: 1.0 });
  seedItems.push({ category: "area_perhatian", fact: "Frustrasi kalau orang lambat atau gak inisiatif", confidence: 1.0 });

  seedItems.push({ category: "filosofi_hidup", fact: "Legacy jangka panjang > hasil instan", confidence: 1.0 });
  seedItems.push({ category: "filosofi_hidup", fact: "Sistem > individu — bangun yang bisa jalan tanpa ketergantungan satu orang", confidence: 1.0 });
  seedItems.push({ category: "filosofi_hidup", fact: "Speed over protocol — lebih baik minta maaf daripada izin", confidence: 1.0 });
  seedItems.push({ category: "filosofi_hidup", fact: "Meritokrasi ide, bukan senioritas", confidence: 1.0 });
  seedItems.push({ category: "filosofi_hidup", fact: "Data-driven tapi tetap dengar intuisi", confidence: 1.0 });

  seedItems.push({ category: "tokoh_inspirasi", fact: "Modul power dynamics: Machiavelli, Robert Greene, John Gotti, Frank Underwood", confidence: 1.0 });
  seedItems.push({ category: "tokoh_inspirasi", fact: "Modul wisdom & kesabaran: Vito Corleone, Sun Tzu, Warren Buffett", confidence: 1.0 });
  seedItems.push({ category: "tokoh_inspirasi", fact: "Modul leadership: John Maxwell, Umar bin Khattab", confidence: 1.0 });
  seedItems.push({ category: "tokoh_inspirasi", fact: "Modul visionary: Steve Jobs, Elon Musk, Steve Wozniak", confidence: 1.0 });
  seedItems.push({ category: "tokoh_inspirasi", fact: "Modul self-mastery: Miyamoto Musashi, Marcus Aurelius", confidence: 1.0 });
  seedItems.push({ category: "tokoh_inspirasi", fact: "Modul spiritual: Al-Ghazali, Malcolm X, Nabi Muhammad SAW", confidence: 1.0 });

  seedItems.push({ category: "panggilan", fact: "DR / Raha / Bapak / Bapa / Abah / YKW / mas DR. TIDAK SUKA dipanggil 'Boss'", confidence: 1.0 });

  seedItems.push({ category: "keluarga", fact: "Lisa (istri), Vito (anak sulung), Veeta (anak bungsu)", confidence: 1.0 });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const item of seedItems) {
      await client.query(
        `INSERT INTO profile_enrichments (user_id, category, fact, confidence, source_quote) VALUES ($1, $2, $3, $4, $5)`,
        [userId, item.category, item.fact, item.confidence, "Seeded from DARVIS_PROFILE_DR.md"]
      );
    }
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
  console.log(`Profile DR seeded for ${userId}: ${seedItems.length} facts`);
}

export interface ChatRoom {
  id: number;
  session_id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export async function getChatRooms(sessionId: string): Promise<ChatRoom[]> {
  const result = await pool.query(
    `SELECT * FROM chat_rooms WHERE session_id = $1 ORDER BY updated_at DESC`,
    [sessionId]
  );
  return result.rows as ChatRoom[];
}

export async function getChatRoomById(id: number): Promise<ChatRoom | undefined> {
  const result = await pool.query(`SELECT * FROM chat_rooms WHERE id = $1`, [id]);
  return result.rows[0] as ChatRoom | undefined;
}

export async function createChatRoom(sessionId: string, title?: string): Promise<number> {
  const result = await pool.query(
    `INSERT INTO chat_rooms (session_id, title) VALUES ($1, $2) RETURNING id`,
    [sessionId, title || "Obrolan Baru"]
  );
  return result.rows[0].id as number;
}

export async function renameChatRoom(id: number, title: string) {
  await pool.query(
    `UPDATE chat_rooms SET title = $1, updated_at = NOW()::TEXT WHERE id = $2`,
    [title, id]
  );
}

export async function deleteChatRoom(id: number) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`DELETE FROM conversations WHERE room_id = $1`, [id]);
    await client.query(`DELETE FROM chat_rooms WHERE id = $1`, [id]);
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

export async function touchChatRoom(id: number) {
  await pool.query(
    `UPDATE chat_rooms SET updated_at = NOW()::TEXT WHERE id = $1`,
    [id]
  );
}

export async function getLastMessagesForRoom(roomId: number, limit: number = 10) {
  const result = await pool.query(
    `SELECT role, content FROM conversations WHERE room_id = $1 ORDER BY id DESC LIMIT $2`,
    [roomId, limit]
  );
  return (result.rows as { role: string; content: string }[]).reverse();
}

export async function getAllMessagesForRoom(roomId: number) {
  const result = await pool.query(
    `SELECT role, content FROM conversations WHERE room_id = $1 ORDER BY id ASC`,
    [roomId]
  );
  return result.rows as { role: string; content: string }[];
}

export async function saveMessageToRoom(roomId: number, userId: string, role: "user" | "assistant", content: string) {
  await pool.query(
    `INSERT INTO conversations (user_id, role, content, room_id) VALUES ($1, $2, $3, $4)`,
    [userId, role, content, roomId]
  );
  await touchChatRoom(roomId);
}

export async function getMessageCountForRoom(roomId: number): Promise<number> {
  const result = await pool.query(
    `SELECT COUNT(*) as count FROM conversations WHERE room_id = $1`,
    [roomId]
  );
  return parseInt(result.rows[0].count, 10);
}

export async function clearRoomHistory(roomId: number) {
  await pool.query(`DELETE FROM conversations WHERE room_id = $1`, [roomId]);
}

export async function getRoomSummary(roomId: number): Promise<string | null> {
  const key = `room_summary_${roomId}`;
  return getSetting(key);
}

export async function setRoomSummary(roomId: number, summary: string) {
  const key = `room_summary_${roomId}`;
  await setSetting(key, summary);
}

export async function getAllRoomSummaries(sessionId: string): Promise<{ roomId: number; title: string; summary: string | null }[]> {
  const rooms = await getChatRooms(sessionId);
  const results: { roomId: number; title: string; summary: string | null }[] = [];
  for (const r of rooms) {
    const summary = await getRoomSummary(r.id);
    results.push({ roomId: r.id, title: r.title, summary });
  }
  return results;
}

export async function moveMessagesToRoom(userId: string, roomId: number) {
  await pool.query(
    `UPDATE conversations SET room_id = $1 WHERE user_id = $2 AND room_id IS NULL`,
    [roomId, userId]
  );
  await touchChatRoom(roomId);
}

export async function mergeRooms(targetRoomId: number, sourceRoomIds: number[]) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const sourceId of sourceRoomIds) {
      await client.query(`UPDATE conversations SET room_id = $1 WHERE room_id = $2`, [targetRoomId, sourceId]);
      await client.query(`DELETE FROM app_settings WHERE key = $1`, [`room_summary_${sourceId}`]);
      await client.query(`DELETE FROM chat_rooms WHERE id = $1`, [sourceId]);
    }
    await client.query(`DELETE FROM app_settings WHERE key = $1`, [`room_summary_${targetRoomId}`]);
    await client.query(`UPDATE chat_rooms SET updated_at = NOW()::TEXT WHERE id = $1`, [targetRoomId]);
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

export default pool;
