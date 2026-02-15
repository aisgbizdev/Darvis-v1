# DARVIS - DiAn Raha Vision v2.0

## Overview
DARVIS is an AI-powered thinking framework distributor, designed to disseminate thinking patterns and decision-making frameworks. Its core philosophy is to distribute frameworks rather than personal branding, offering a single core thinking engine with two presentation layers (Mirror/Twin). The project aims to provide an advanced AI companion for strategic thinking, decision-making, and personal development, leveraging a multi-persona approach to offer diverse perspectives.

## User Preferences
- **Bahasa**: Selalu gunakan Bahasa Indonesia untuk semua komunikasi dan respons. Jangan campur dengan bahasa Inggris supaya tidak salah tafsir.

## System Architecture
DARVIS employs a modern web architecture with a React-based frontend, an Express.js backend, and a SQLite database for persistence.

- **UI/UX Decisions**:
    - Single-page minimalist chat UI.
    - **Quad-persona display (Mirror Mode)**: Visual cards representing Broto (logis, tegas, risiko), Rara (reflektif, empatik, emosi), Rere (pelengkap, kreatif, devil's advocate), and DR (digital twin, santai, CBD perspective).
    - Context mode UI indicator (subtle badge below last assistant message).
    - Preferences panel (lightbulb icon) to view learned preferences and profile enrichments.
    - Owner login (lock icon) and logout functionality for Mirror Mode.
    - Adaptive empty state based on presentation mode.
    - PWA support for installability on mobile devices, including manifest.json and service worker for offline capabilities.
    - Download Conversation feature (MD + PDF) with professional report header/footer.
    - Markdown rendering in chat (react-markdown) — bold, italic, heading, list, blockquote, code, emoji.
    - Optimized system prompt (65-70% token reduction) + prompt file caching + SSE flush for faster streaming.
    - Voice Input for speech-to-text.
    - Voice Conversation Mode (hands-free): VAD with 2.5s silence auto-send, TTS auto-play after response, voice selector (9 OpenAI voices), conversation loop (speak → listen → respond → speak).
    - Per-message TTS playback: hover speaker icon on any assistant message to hear it read aloud.
    - Image Upload & Analysis for multi-image processing.

- **Technical Implementations**:
    - **Frontend**: React, TypeScript, Tailwind CSS, shadcn/ui.
    - **Backend**: Express.js with OpenAI API integration.
    - **AI Model**: GPT-5 via OpenAI API.
    - **State/Database**: Server-side SQLite (better-sqlite3) using `darvis.db` for persistent chat history, auto-summary, learned preferences, profile enrichments, and conversation tags.
    - **Core System Prompt**: `prompts/DARVIS_CORE.md` defines quad-persona rules and context mode rules.
    - **Profile Foundation**: `prompts/DARVIS_PROFILE_DR.md` for DR's foundational knowledge.
    - **Node System**: Modular context nodes (`NODE_SOLIDGROUP`, `NODE_BIAS`, `NODE_AiSG`, `NODE_NM`, `NODE_RISK_GUARD`, `NODE_COMPLIANCE`) injected based on intent detection. Priority: `NODE_BIAS` > `NODE_RISK_GUARD` > `NODE_NM` > other nodes.
    - **Context Mode Engine (v2.0)**: Auto-detects conversation context (strategic, tactical, reflection, crisis, general) via keyword patterns and injects a framing layer into the system prompt.
    - **Silent Tagging System (v2.0)**: Captures conversation metadata (context_mode, decision_type, emotional_tone, nodes_active, etc.) in `conversation_tags` table for future pattern detection.
    - **Mirror/Twin/Contributor Presentation Architecture (v2.0)**:
        - **Mirror Mode (Owner only)**: Full persona cards, sharper tone, owner identity references, preferences panel, profile enrichment.
        - **Twin Mode (Default for all users)**: Unified voice, no persona labels, no owner identity references, framework-first approach.
        - **Contributor Mode (Password-protected)**: Unified voice like Twin, but DARVIS knows user kenal DR. Every message auto-extracted as profile enrichment → stored to shared pool (`contributor_shared`). Owner's prompt pulls from both own enrichments and contributor pool.
        - **Contributor Self-Profile (v2.0)**: After login, DARVIS asks contributor's name. If matched to team_members (via name/alias), session stores `contributorTeamMemberId`/`contributorTeamMemberName`. DARVIS becomes natural interviewer, extracting persona data (job desk, work_style, communication_style, triggers, commitments, personality_notes) from conversation. Auto-detection from message content + `/api/contributor-identify` endpoint. Dual extraction: DR enrichment + self persona. Fallback to regular Contributor if name not matched.
        - Server-side transformation (`mergePersonasToUnifiedVoice()`, `redactOwnerIdentity()`) to adapt output based on presentation mode.
        - Single login field — password determines mode (Owner vs Contributor vs wrong).
    - **Persona System (v2.0)**:
        - Default unified voice, with multi-persona output activated on demand in Mirror Mode.
        - DR persona speaks like "mas DR" (Mirror only).
    - **Auto-Learn System**: Extracts user preferences every 10 messages across 12 categories, stores them in `learned_preferences`, and injects them into the system prompt for personalized responses.
    - **Profile Enrichment System**: Automatically detects and extracts DR's self-descriptions from conversations, storing them in `profile_enrichments` and injecting them into the system prompt.
    - **Passive Listening System**: Detects and extracts user feedback on personas, stores it in `persona_feedback`, and injects top feedback into the system prompt.
    - **Session Management**: `express-session` with unique session IDs for isolation of chat history and learned data per browser/device.
    - **Anti Echo-Chamber Protocol**: DARVIS provides counter-angles for user's firm beliefs or high-stakes decisions.
    - **Memory Governor**: Limits injected preferences, uses a scoring system, and guards context budget.
    - **Decision Fast Mode**: Provides concise 3-bullet summaries with risks, blind spots, and actions when triggered.
    - **Streaming SSE responses**: Real-time word-by-word response delivery.
    - **Secretary System (v2.0)**: Strategic secretary layer in Mirror Mode — manages team members, meetings, action items, and projects.
        - Database tables: `team_members` (with `aliases` and `category` columns), `meetings`, `action_items`, `projects`, `notifications`.
        - **People Database**: 31 seeded people across categories: BD team (14), direksi 5 PT (10), management (3), family (3). Each person can have aliases (e.g., "Tailo" = Nelson Lee, "Mas Ir" = Iriawan).
        - **Categories**: `team` (BD staff), `direksi` (directors of 5 PTs), `management` (atasan/key people), `family` (keluarga DR), `external` (orang luar).
        - **Alias Resolution**: `getTeamMemberByNameOrAlias()` checks both name and comma-separated aliases to prevent duplicates when DR uses different names for the same person.
        - **Auto-Detect Nama Baru (Mirror Mode)**: When DR mentions an unknown name, DARVIS asks "Siapa [nama]?" and saves the answer to the database. NODE_TEAM always injected in Mirror Mode with grouped categories.
        - Auto-extraction from conversation: GPT-powered extraction of team profiles (with aliases/category), meetings, action items, projects from natural chat in Mirror Mode.
        - Dynamic context injection: `NODE_TEAM` (always in Mirror), `NODE_MEETING`, `NODE_PROJECTS` injected based on intent detection.
        - Proactive notifications: meeting reminders (30min before), overdue alerts, project deadlines (3 days), daily briefing (6-9am), DARVIS insights (max 2-3x/day).
        - Secretary Dashboard: accessible via header icon (owner-only), 4 tabs (Tim, Meeting, Action Items, Projects) with full CRUD, inline editing, status toggling. Shows category badges and aliases. Team cards have expandable persona detail panel (brain icon indicator).
        - **Team Persona Profiling (v2.0)**: DARVIS auto-extracts persona data (work_style, communication_style, triggers, commitments, personality_notes) from natural conversation and file uploads in Mirror Mode. Persona data injected into context when discussing delegation, team assignments, or character topics. Database columns added to `team_members` table. `appendIfNew()` logic prevents duplicate persona entries.
        - Notification Center: bell icon with unread badge, grouped notifications by type.
        - All secretary features owner-only protected.
    - **Conversation Rooms (v2.0, Owner-only)**: Organize chat history by topic while maintaining unified global context across all rooms.
        - Database: `chat_rooms` table with `session_id`, `title`, `created_at`, `updated_at`. Conversations linked via `room_id`.
        - API: `/api/rooms` (GET list, POST create, PATCH rename, DELETE, POST merge), room-aware `/api/history?roomId=X`, `/api/chat` with `roomId` in payload, `/api/clear` with `roomId`.
        - Frontend: `ConversationSidebar` component with room list, create/rename/delete/merge. Toggle via PanelLeft icon in header (owner-only). Desktop: 224px side panel. Mobile: full-screen drawer with backdrop.
        - **Lobby**: Default free-chat area (no room). Messages in lobby can be auto-routed to rooms.
        - Key design: All learned preferences, profile enrichments, persona feedback, and secretary data remain **global shared** across rooms — DARVIS maintains unified "brain" unlike ChatGPT's isolated conversations.
        - Auto-summary per room via `generateRoomSummary()`.
        - **Auto-Room Management (v2.0)**: GPT-powered `detectRoomAction()` analyzes lobby messages against existing room summaries. Actions: `stay_lobby` (casual chat), `move_to_existing` (topic matches existing room), `create_new` (substantive new topic). Runs in parallel with chat completion to avoid latency. Frontend auto-switches room with toast notification.
        - **Room Merge**: Owner can select 2+ rooms in sidebar merge mode, first selected becomes target. `mergeRooms()` atomically moves all messages and deletes source rooms. Server validates room ownership.
    - **Key Files**: `server/proactive.ts` (proactive system), `client/src/components/secretary-dashboard.tsx`, `client/src/components/notification-center.tsx`, `client/src/components/conversation-sidebar.tsx`.

## External Dependencies
- **OpenAI API**: Used for AI model inference (GPT-5).
- **Web Speech API (Browser)**: Utilized for the Voice Input feature to convert speech to text.