# DARVIS - DiAn Raha Vision v0.3

## Overview
DARVIS is an AI-powered thinking companion web application with quad-persona output (Broto, Rara, Rere, DR). Built for mas DR as a tool to help think more clearly before making decisions. Long-term vision: become a digital twin of mas DR's thinking style — so others can consult DARVIS and get perspectives reflecting how DR thinks, questions, and decides.

## User Preferences
- **Bahasa**: Selalu gunakan Bahasa Indonesia untuk semua komunikasi dan respons. Jangan campur dengan bahasa Inggris supaya tidak salah tafsir.

## Architecture
- **Frontend**: React + TypeScript + Tailwind CSS + shadcn/ui
- **Backend**: Express.js with OpenAI API integration
- **AI Model**: GPT-5 via OpenAI API
- **State**: Server-side SQLite (better-sqlite3) for persistent chat history + auto-summary
- **Database**: darvis.db (SQLite, WAL mode)

## Key Files
- `client/src/pages/chat.tsx` - Main chat UI page (4-persona display)
- `server/routes.ts` - /api/chat endpoint with OpenAI integration
- `shared/schema.ts` - ChatMessage, ChatRequest, ChatResponse types
- `prompts/DARVIS_CORE.md` - Core system prompt (quad-persona rules v0.2)
- `prompts/DARVIS_PROFILE_DR.md` - DR's foundational profile (digital twin knowledge base)
- `prompts/DARVIS_NODE_SolidGroup.md` - Solid Group context node
- `prompts/DARVIS_NODE_BIAS.md` - Behavioral bias & emotional context node
- `prompts/DARVIS_NODE_AiSG.md` - Audit intelligence & governance context node
- `prompts/DARVIS_NODE_NM.md` - Market intelligence & data authority context node
- `prompts/DARVIS_NODE_RISK_GUARD.md` - Risk education & mitigation context node
- `prompts/DARVIS_NODE_COMPLIANCE.md` - Preventive compliance & operational risk context node

## Features
- Single-page minimalist chat UI with 4-persona visual cards
- Quad-persona output:
  - **Broto** (blue/Shield): logis, tegas, fokus risiko & konsekuensi
  - **Rara** (rose/Heart): reflektif, empatik, mempertimbangkan emosi & jangka panjang
  - **Rere** (amber/Sparkles): pelengkap, kreatif, alternatif, devil's advocate
  - **DR** (emerald/User): digital twin mas DR, santai tapi tegas, CBD perspective
- DR profile foundation loaded from DARVIS_PROFILE_DR.md
- Profile auto-seeding on first load (13 foundational insights)
- Intent detection for Solid Group topics
- Intent detection for behavioral/emotional bias
- Intent detection for audit/governance
- Intent detection for market/data
- Intent detection for risk education
- Intent detection for compliance/operational risk
- Multi-node support with priority system
- Server-side SQLite persistent chat history with 20-message context window + auto-summary
- Chain of Thought reasoning (internal, not shown to user)
- Clarifying Questions capability (DARVIS can ask back when context is unclear)
- Auto-learn system: AI-powered preference extraction every 10 messages
- 12 auto-learn categories including prinsip_hidup, filosofi_bisnis, gaya_bahasa
- Learned preferences injected into system prompt for personalized responses
- Preferences panel (lightbulb icon) to view what DARVIS has learned
- Clear chat functionality (also clears learned preferences)
- Post-processing to enforce 4-persona format
- Proactive Reflection across all personas
- Tone Detection: emotional/analytical/evaluative/urgent

## Node System
- **NODE_SOLIDGROUP**: Solid Group business context
- **NODE_BIAS**: Behavioral intelligence & human risk
- **NODE_AiSG**: Audit intelligence & governance
- **NODE_NM**: Market intelligence & data authority
- **NODE_RISK_GUARD**: Risk education & mitigation
- **NODE_COMPLIANCE**: Preventive compliance & operational risk
- Priority: NODE_BIAS > NODE_RISK_GUARD > NODE_NM > other nodes

## Persona System (v0.3)
- 4 internal perspectives: Broto, Rara, Rere, DR
- **DEFAULT mode**: Single unified DARVIS voice (integrates all 4 perspectives into one coherent response)
- **MULTI-PERSONA mode**: On-demand only — activated when user explicitly asks for persona opinions
  - Triggers: "menurut Broto", "minta pendapat semua persona", "dari 4 sudut pandang", etc.
  - Shows 4 persona cards with labeled responses
- DR speaks like mas DR, powered by DARVIS_PROFILE_DR.md + Auto-Learn
- detectMultiPersonaIntent() in server/routes.ts handles mode detection

## Auto-Learn System
- **Trigger**: Every 10 messages, AI extracts user preferences
- **Categories**: gaya_berpikir, preferensi_komunikasi, konteks_bisnis, pola_keputusan, area_fokus, koreksi_penting, gaya_kepemimpinan, pola_stres, area_blind_spot, prinsip_hidup, filosofi_bisnis, gaya_bahasa
- **Seed**: POST /api/seed-profile seeds 13 foundational insights from DR profile
- **Storage**: learned_preferences table in SQLite
- **Injection**: Preferences injected into system prompt as AUTO-LEARN block
- **UI**: Lightbulb icon in header → panel showing learned insights grouped by category
- **Clear**: Clearing chat also clears all learned preferences
- **Endpoints**: GET /api/preferences, POST /api/clear, POST /api/seed-profile

## Environment
- `OPENAI_API_KEY` - Required, stored in Replit Secrets

## Profile Enrichment System (Otomatis dari Percakapan)
- **Trigger**: Deteksi otomatis ketika DR cerita tentang dirinya sendiri (identitas, preferensi, karakter)
- **Detection**: Pattern matching — "gw DR", "gw suka", "orang mikir gw", "tokoh idola", "film favorit", dll
- **Extraction**: AI-powered extraction → category, fact, confidence, source_quote
- **Categories**: persepsi_orang, tokoh_idola, film_favorit, prinsip_spiritual, karakter_personal, kebiasaan, filosofi, preferensi
- **Storage**: profile_enrichments table in SQLite
- **Injection**: Enrichments injected into system prompt as PROFIL ENRICHMENT block
- **UI**: Shown in preferences panel under "Profil DR dari Percakapan" with violet color scheme
- **Clear**: Clearing chat also clears profile enrichments
- **Endpoint**: GET /api/profile-enrichments
- **Philosophy**: DR gak perlu masuk Replit — cukup ngobrol di DARVIS, profil otomatis makin kaya

## Passive Listening System
- **Trigger**: Deteksi otomatis ketika orang menyebut DR/Broto/Rara/Rere dengan opini/kesan
- **Detection**: Cek nama persona + sinyal opini (adjective, opinion words, etc.)
- **Extraction**: AI-powered extraction → target, feedback, sentiment, confidence
- **Storage**: persona_feedback table in SQLite
- **Injection**: Top 5 feedback per persona injected into system prompt
- **UI**: Shown in preferences panel under "Kesan Orang Lain" with color-coded sentiment dots
- **Clear**: Clearing chat also clears persona feedback
- **Endpoint**: GET /api/persona-feedback

## Recent Changes
- 2026-02-11: Added Voice Input — tombol mic untuk speech-to-text, Bahasa Indonesia, pakai Web Speech API browser
- 2026-02-11: **v0.3 — Single Voice Default** — DARVIS now responds as one unified voice by default, multi-persona only on-demand
- 2026-02-11: Added DR aliases (Raha, Bapak, Bapa) to passive listening & profile enrichment detection
- 2026-02-11: Added "gak suka dipanggil Boss" to DR profile
- 2026-02-11: Added Profile Enrichment system — DR bisa perkaya profil cukup dari percakapan DARVIS, gak perlu masuk Replit
- 2026-02-11: Added Resource Referral system (NODE_RESOURCES) — natural referensi ke produk ekosistem, buku, tokoh, film
- 2026-02-11: Enriched DR character — persepsi orang (Jordan Belfort, Vito Corleone, Steve Jobs), tokoh idola, film favorit
- 2026-02-11: Added Passive Listening system — otomatis tangkap kesan orang tentang DR/Broto/Rara/Rere
- 2026-02-11: Updated branding — removed "DiAn Raha" references, logo custom, "Thinking Companion" subtitle
- 2026-02-11: Updated empty state — digital twin positioning, no persona badges
- 2026-02-11: **v0.2 MAJOR UPGRADE** — 4-persona system (Broto, Rara, Rere, DR)
- 2026-02-11: Created DARVIS_PROFILE_DR.md — comprehensive DR profile curated from 13 personal documents
- 2026-02-11: Added Rere persona (complementary/creative perspectives)
- 2026-02-11: Added DR persona (digital twin, speaks like mas DR)
- 2026-02-11: Updated UI with 4 persona cards (color-coded: blue/rose/amber/emerald)
- 2026-02-11: Added profile auto-seeding (13 foundational insights)
- 2026-02-11: Upgraded context window from 10 to 20 messages
- 2026-02-11: Added Chain of Thought reasoning capability
- 2026-02-11: Added Clarifying Questions capability
- 2026-02-11: Added 3 new auto-learn categories: prinsip_hidup, filosofi_bisnis, gaya_bahasa
- 2026-02-11: Added Konteks Pengguna, Proactive Reflection, Tone Detection
- 2026-02-11: Added NODE_COMPLIANCE, enriched all existing nodes
- 2026-02-10: Initial v0.1 implementation
