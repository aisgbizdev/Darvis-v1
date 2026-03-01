# DARVIS - DiAn Raha Vision v2.0

## Overview
DARVIS is an AI-powered thinking framework distributor, designed to disseminate thinking patterns and decision-making frameworks. It provides an advanced AI companion for strategic thinking, decision-making, and personal development, leveraging a multi-persona approach to offer diverse perspectives. The project's core philosophy is to distribute frameworks rather than personal branding, offering a single core thinking engine with two presentation layers (Mirror/Twin).

## User Preferences
- **Bahasa**: Selalu gunakan Bahasa Indonesia untuk semua komunikasi dan respons. Jangan campur dengan bahasa Inggris supaya tidak salah tafsir.

## System Architecture
DARVIS utilizes a modern web architecture.

**UI/UX Decisions:**
- Single-page minimalist chat UI with PWA support.
- Quad-persona display for Mirror Mode (Broto, Rara, Rere, DR) with context mode indicators.
- Preferences panel and owner login functionality.
- Adaptive empty states and download conversation features (MD + PDF).
- Markdown rendering, Voice Input, Voice Conversation Mode (VAD, TTS auto-play), and per-message TTS playback.
- Image Upload & Analysis for multi-image processing.
- Secretary Dashboard (owner-only) with CRUD operations for team, meetings, action items, and projects.
- Notification Center and Conversation Rooms sidebar.

**Technical Implementations:**
- **Frontend**: React, TypeScript, Tailwind CSS, shadcn/ui.
- **Backend**: Express.js.
- **AI Model**: Smart model routing with GPT-5 for complex tasks, GPT-4o-mini for casual chat and background extractions. Includes a fallback chain: GPT-5 → GPT-4o → GPT-4o-mini → Gemini 2.5 Flash → Ollama.
- **State/Database**: PostgreSQL for persistent chat history, auto-summary, learned preferences, profile enrichments, and conversation tags.
- **Core System Prompt**: `prompts/DARVIS_CORE.md` defines quad-persona and context mode rules.
- **Profile Foundation**: `prompts/DARVIS_PROFILE_DR.md` for DR's foundational knowledge.
- **Node System**: Modular context nodes injected based on intent detection, including `NODE_ECOSYSTEM`, `NODE_BD_MASTER`, and others.
- **Context Mode Engine (v2.0)**: Auto-detects conversation context (strategic, tactical, reflection, crisis, general) and injects framing layers.
- **Silent Tagging System (v2.0)**: Captures conversation metadata for pattern detection.
- **Presentation Architecture (v2.0)**:
    - **Mirror Mode (Owner only)**: Full persona cards, owner identity references, preferences panel.
    - **Twin Mode (Default)**: Unified voice, no persona labels, framework-first approach.
    - **Contributor Mode (Password-protected)**: Unified voice, auto-extracts profile enrichment for a shared pool.
    - **Contributor Self-Profile (v2.0)**: Extracts detailed persona data from conversation.
- **Persona System (v2.0)**: Default unified voice; multi-persona output on demand in Mirror Mode.
- **Auto-Learn System**: Extracts and injects user preferences into the system prompt.
- **Profile Enrichment System**: Automatically extracts and injects DR's self-descriptions.
- **Passive Listening System**: Detects and injects user feedback on personas.
- **Session Management**: `express-session` for isolated chat history.
- **Anti Echo-Chamber Protocol**: Provides counter-angles for user's beliefs.
- **Memory Governor**: Limits injected preferences and manages context budget.
- **Decision Fast Mode**: Provides concise 3-bullet summaries.
- **Streaming SSE responses**: Real-time response delivery.
- **Secretary System (v2.0, Mirror Mode)**: Manages team members, meetings, action items, and projects.
    - Includes `team_members` with aliases and categories, `meetings`, `action_items`, `projects`, `notifications`, `secretary_pending`.
    - Features a seeded people database, alias resolution, auto-detection of new names, and GPT-powered extraction of secretary data from conversations.
    - **Hybrid Extraction (v2.2)**: Explicit requests (keyword trigger like "catat", "meeting", "ingetin") → direct save to real tables + toast confirmation. Implicit extraction (from conversation context) → `secretary_pending` table for user review. Team members and existing project updates still auto-save.
    - **Extraction Timing (v2.2)**: `extractSecretaryData` runs BEFORE donePayload (with 8s timeout), so `pendingSecretaryCount` is accurate in real-time. Multi-turn context (10 turns) for better extraction.
    - **Fuzzy Project Matching (v2.2)**: Project names matched with word overlap ≥60% fallback. GPT instructed to use exact existing project names.
    - Dynamic context injection for secretary nodes (`NODE_TEAM`, `NODE_MEETING`, `NODE_PROJECTS`).
    - **Expired Items Notification (v2.1)**: Overdue items and past meetings trigger `expired_review` notifications. User decides Keep or Hapus — no auto-archive.
    - **Pending Visibility (v2.2)**: Frontend polls pending count every 30s. Badge always visible. Bulk approve/reject available.
    - Proactive notifications for meetings and deadlines.
    - All date/time operations use `Asia/Jakarta` (WIB).
    - Team Persona Profiling (v2.0): Extracts work style, communication style, etc., from conversations.
    - Multi-select batch delete for meetings and action items.
- **Conversation Rooms (v2.0, Owner-only)**: Organizes chat history by topic while maintaining global context.
    - `chat_rooms` table with API for management.
    - "Lobby" for default free-chat, with **approval-based room suggestion** (v2.1): system suggests room, user approves, messages are COPIED (not moved) to room. Lobby stays intact. Cooldown 1 minute between suggestions. detectRoomAction prompt prioritizes MOVE > CREATE > LOBBY for substantive topics.
    - Supports room merging.
    - Key design: global shared preferences and secretary data across all rooms.
    - Smart Room Context: injects relevant history or summary when entering a room.
    - Secretary Knowledge Injection (v2.1): All secretary data feeds DARVIS context with mandatory usage instruction.
    - Project editing: progress slider, status dropdown, milestones, deadline, description, notes.
    - Fuzzy deduplication for action items. Stricter extraction rules (only explicit requests/delegations).
- **Mirror Mode Refinements (v2.3)**:
    - Notulen format only activates on explicit user request or after 5+ substantive turns (not by default).
    - Bottom-of-chat cards prioritized: only 1 card at a time (room suggestion takes priority over pending card).
    - Implicit secretary extraction gated: only runs in strategic/tactical/crisis context modes or when explicit keywords detected. General context skipped to reduce noise.
    - Dashboard Secretary shortcut icon added directly to header (1-click access) with pending badge.
    - Voice conversation mode indicator text shows feature limitations ("respons dipersingkat, tanpa node konteks").

## External Dependencies
- **OpenAI API**: Used for AI model inference (GPT-5, GPT-4o-mini).
- **Web Speech API (Browser)**: For speech-to-text functionality.