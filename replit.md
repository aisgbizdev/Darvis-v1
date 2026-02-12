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
    - **Mirror/Twin Presentation Architecture (v2.0)**:
        - **Mirror Mode (Owner only)**: Full persona cards, sharper tone, owner identity references, preferences panel, profile enrichment.
        - **Twin Mode (Default for all users)**: Unified voice, no persona labels, no owner identity references, framework-first approach.
        - Server-side transformation (`mergePersonasToUnifiedVoice()`, `redactOwnerIdentity()`) to adapt output based on presentation mode.
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

## External Dependencies
- **OpenAI API**: Used for AI model inference (GPT-5).
- **Web Speech API (Browser)**: Utilized for the Voice Input feature to convert speech to text.