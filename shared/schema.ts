import { z } from "zod";
import { pgTable, serial, text, integer, doublePrecision, varchar, json, timestamp } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const conversations = pgTable("conversations", {
  id: serial("id").primaryKey(),
  user_id: text("user_id").notNull().default("mas_dr"),
  role: text("role").notNull(),
  content: text("content").notNull(),
  room_id: integer("room_id"),
  created_at: text("created_at").notNull().default(sql`now()::text`),
});

export const learned_preferences = pgTable("learned_preferences", {
  id: serial("id").primaryKey(),
  user_id: text("user_id").notNull().default("mas_dr"),
  category: text("category").notNull(),
  insight: text("insight").notNull(),
  confidence: doublePrecision("confidence").notNull().default(0.7),
  source_summary: text("source_summary"),
  created_at: text("created_at").notNull().default(sql`now()::text`),
  updated_at: text("updated_at").notNull().default(sql`now()::text`),
});

export const profile_enrichments = pgTable("profile_enrichments", {
  id: serial("id").primaryKey(),
  user_id: text("user_id").notNull().default("mas_dr"),
  category: text("category").notNull(),
  fact: text("fact").notNull(),
  confidence: doublePrecision("confidence").notNull().default(0.8),
  source_quote: text("source_quote"),
  created_at: text("created_at").notNull().default(sql`now()::text`),
});

export const persona_feedback = pgTable("persona_feedback", {
  id: serial("id").primaryKey(),
  user_id: text("user_id").notNull().default("mas_dr"),
  target: text("target").notNull(),
  feedback: text("feedback").notNull(),
  sentiment: text("sentiment").notNull().default("neutral"),
  confidence: doublePrecision("confidence").notNull().default(0.7),
  source_context: text("source_context"),
  created_at: text("created_at").notNull().default(sql`now()::text`),
});

export const summaries = pgTable("summaries", {
  id: serial("id").primaryKey(),
  user_id: text("user_id").notNull().default("mas_dr"),
  summary: text("summary").notNull(),
  updated_at: text("updated_at").notNull().default(sql`now()::text`),
});

export const conversation_tags = pgTable("conversation_tags", {
  id: serial("id").primaryKey(),
  user_id: text("user_id").notNull(),
  context_mode: text("context_mode").notNull().default("general"),
  decision_type: text("decision_type"),
  emotional_tone: text("emotional_tone"),
  nodes_active: text("nodes_active"),
  strategic_escalation: integer("strategic_escalation").notNull().default(0),
  fast_decision: integer("fast_decision").notNull().default(0),
  multi_persona: integer("multi_persona").notNull().default(0),
  user_message_preview: text("user_message_preview"),
  created_at: text("created_at").notNull().default(sql`now()::text`),
});

export const team_members = pgTable("team_members", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  position: text("position"),
  strengths: text("strengths"),
  weaknesses: text("weaknesses"),
  responsibilities: text("responsibilities"),
  active_projects: text("active_projects"),
  notes: text("notes"),
  aliases: text("aliases"),
  category: text("category").notNull().default("team"),
  status: text("status").notNull().default("active"),
  work_style: text("work_style"),
  communication_style: text("communication_style"),
  triggers: text("triggers"),
  commitments: text("commitments"),
  personality_notes: text("personality_notes"),
  created_at: text("created_at").notNull().default(sql`now()::text`),
  updated_at: text("updated_at").notNull().default(sql`now()::text`),
});

export const meetings = pgTable("meetings", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  date_time: text("date_time"),
  participants: text("participants"),
  agenda: text("agenda"),
  status: text("status").notNull().default("scheduled"),
  summary: text("summary"),
  decisions: text("decisions"),
  created_at: text("created_at").notNull().default(sql`now()::text`),
  updated_at: text("updated_at").notNull().default(sql`now()::text`),
});

export const action_items = pgTable("action_items", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  assignee: text("assignee"),
  deadline: text("deadline"),
  status: text("status").notNull().default("pending"),
  priority: text("priority").notNull().default("medium"),
  source: text("source"),
  meeting_id: integer("meeting_id"),
  notes: text("notes"),
  created_at: text("created_at").notNull().default(sql`now()::text`),
  updated_at: text("updated_at").notNull().default(sql`now()::text`),
  completed_at: text("completed_at"),
});

export const projects = pgTable("projects", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  pic: text("pic"),
  status: text("status").notNull().default("active"),
  milestones: text("milestones"),
  deadline: text("deadline"),
  progress: integer("progress").default(0),
  notes: text("notes"),
  created_at: text("created_at").notNull().default(sql`now()::text`),
  updated_at: text("updated_at").notNull().default(sql`now()::text`),
});

export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  type: text("type").notNull(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  data: text("data"),
  read: integer("read").notNull().default(0),
  created_at: text("created_at").notNull().default(sql`now()::text`),
});

export const chat_rooms = pgTable("chat_rooms", {
  id: serial("id").primaryKey(),
  session_id: text("session_id").notNull(),
  title: text("title").notNull().default("Obrolan Baru"),
  created_at: text("created_at").notNull().default(sql`now()::text`),
  updated_at: text("updated_at").notNull().default(sql`now()::text`),
});

export const push_subscriptions = pgTable("push_subscriptions", {
  id: serial("id").primaryKey(),
  endpoint: text("endpoint").notNull(),
  keys_p256dh: text("keys_p256dh").notNull(),
  keys_auth: text("keys_auth").notNull(),
  created_at: text("created_at").notNull().default(sql`now()::text`),
});

export const app_settings = pgTable("app_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updated_at: text("updated_at").notNull().default(sql`now()::text`),
});

export const sessions = pgTable("sessions", {
  sid: varchar("sid").primaryKey(),
  sess: json("sess").notNull(),
  expire: timestamp("expire", { precision: 6 }).notNull(),
});

export const chatMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string(),
  images: z.array(z.string()).optional(),
});

export const chatRequestSchema = z.object({
  message: z.string().min(1),
  images: z.array(z.string()).optional(),
  voiceMode: z.boolean().optional(),
  roomId: z.number().optional(),
});

export type ChatMessage = z.infer<typeof chatMessageSchema>;
export type ChatRequest = z.infer<typeof chatRequestSchema>;

export interface ChatResponse {
  reply: string;
  nodeUsed: string | null;
}

export interface HistoryResponse {
  messages: ChatMessage[];
}

export interface LearnedPreferenceItem {
  id: number;
  category: string;
  insight: string;
  confidence: number;
  source_summary: string | null;
  updated_at: string;
}

export interface PreferencesResponse {
  preferences: LearnedPreferenceItem[];
}

export interface PersonaFeedbackItem {
  id: number;
  target: string;
  feedback: string;
  sentiment: string;
  confidence: number;
  source_context: string | null;
  created_at: string;
}

export interface PersonaFeedbackResponse {
  feedback: PersonaFeedbackItem[];
}

export interface ProfileEnrichmentItem {
  id: number;
  category: string;
  fact: string;
  confidence: number;
  source_quote: string | null;
  created_at: string;
}

export interface ProfileEnrichmentsResponse {
  enrichments: ProfileEnrichmentItem[];
}
