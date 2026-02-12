# DARVIS - DiAn Raha Vision v2.0

## Overview
DARVIS is an AI-powered thinking framework distributor. Core philosophy: "Ambil framework-nya, bukan figurnya." Single core thinking engine with two presentation layers (Mirror/Twin). Built to distribute thinking patterns and decision-making frameworks, not personal branding.

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
- `prompts/DARVIS_CORE.md` - Core system prompt (quad-persona rules v2.0)
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
- **v2.0 Context Mode Engine**: Auto-detect strategic/tactical/reflection/crisis context, inject framing layer
- **v2.0 Silent Tagging System**: Conversation metadata captured in database for future Pattern Detection
- Context mode UI indicator (subtle badge below last assistant message)

## Context Mode Engine (v2.0)
- **5 modes**: strategic, tactical, reflection, crisis, general (default)
- Auto-detection via 50+ keyword patterns per mode
- Framing layer injected into system prompt — identity unchanged
- Frontend badge shows active mode (purple/sky/rose/red) when not "general"
- Detection function: `detectContextMode()` in server/routes.ts
- Decision classifier: `classifyDecisionType()` — 9 categories

## Silent Tagging System (v2.0)
- Table: `conversation_tags` in SQLite
- Tags per conversation: context_mode, decision_type, emotional_tone, nodes_active, strategic_escalation, fast_decision, multi_persona
- Purely backend — no UI, no user notification
- Foundation for Phase 2 Pattern Detection
- Database functions: `saveConversationTag()`, `getConversationTags()` in server/db.ts

## Node System
- **NODE_SOLIDGROUP**: Solid Group business context
- **NODE_BIAS**: Behavioral intelligence & human risk
- **NODE_AiSG**: Audit intelligence & governance
- **NODE_NM**: Market intelligence & data authority
- **NODE_RISK_GUARD**: Risk education & mitigation
- **NODE_COMPLIANCE**: Preventive compliance & operational risk
- Priority: NODE_BIAS > NODE_RISK_GUARD > NODE_NM > other nodes

## Mirror/Twin Presentation Architecture (v2.0)
- **Core principle**: Single thinking engine, two presentation layers
- **Mirror Mode** (owner only): Full persona cards (Broto/Rara/Rere/DR), sharper tone, "mas DR" sapaan, preferences panel, profile enrichment
- **Twin Mode** (default for all users): Unified voice, no persona labels, no owner identity references, framework-first
- **Authentication**: POST /api/owner-login with OWNER_PASSWORD, POST /api/owner-logout, GET /api/session-info
- **Server-side transform**: `mergePersonasToUnifiedVoice()` strips persona labels, `redactOwnerIdentity()` removes "mas DR", "Bapak", etc.
- **System prompt injection**: PRESENTATION MODE block added (Mirror/Twin) before response mode
- **Frontend**: Lock icon for owner login, LogOut for logout, empty state adapts per mode
- **Secret**: OWNER_PASSWORD from Replit Secrets

## Persona System (v2.0)
- 4 internal perspectives: Broto, Rara, Rere, DR
- **Mirror Mode DEFAULT**: Single unified DARVIS voice (integrates all 4 perspectives into one coherent response)
- **Mirror Mode MULTI-PERSONA**: On-demand only — activated when owner explicitly asks for persona opinions
  - Triggers: "menurut Broto", "minta pendapat semua persona", "dari 4 sudut pandang", etc.
  - Shows 4 persona cards with labeled responses
- **Twin Mode**: Always unified voice, multi-persona disabled, persona labels stripped server-side
- DR speaks like mas DR (Mirror only), powered by DARVIS_PROFILE_DR.md + Auto-Learn
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
- `OWNER_PASSWORD` - Required for Mirror Mode authentication
- `SESSION_SECRET` - Required for session management

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

## PWA (Progressive Web App)
- manifest.json at /manifest.json (name: DARVIS, standalone, portrait)
- Service worker at /sw.js (cache-first for static, network-first for API)
- Apple meta tags for iOS Add to Home Screen (apple-mobile-web-app-capable, apple-touch-icon)
- Android installable via Chrome's "Add to Home Screen"
- Icons: darvis-logo.png (512x512), favicon.png (192x192)

## Session & User Isolation
- **Mechanism**: express-session with unique session ID per browser/device
- **Cookie**: 1-year maxAge, httpOnly, sameSite=lax
- **User ID**: Auto-generated per session (`user_{timestamp}_{random}`)
- **Isolation**: Chat history, preferences, and auto-learn data are per-session
- **Secret**: SESSION_SECRET from Replit Secrets

## v1.1 Improvements (Broto Review)
- **Anti Echo-Chamber Protocol**: DARVIS wajib kasih counter-angle saat user terlalu yakin / high-stakes decision
- **Memory Governor**: Injection preferensi dibatasi max 5 poin high-signal, scoring system (confidence 40% + recency 60%), context budget guard (reduce messages saat banyak node aktif)
- **Decision Fast Mode**: Trigger "quick/ringkas/fast decision" → format 3 bullet + 1 risk + 1 blind spot + 1 aksi
- **Confidence Tone Calibration**: Tone deskriptif untuk data, reflektif untuk opini, rendah klaim untuk prediksi
- **NODE_RESOURCES Softening**: Max 1 referensi per jawaban, jangan pernah buka respons dengan referensi
- **Strategic Escalation Logic**: Layer risiko sistemik/reputasi/jangka panjang untuk keputusan besar

## Recent Changes
- 2026-02-12: **v2.0 Phase 2 — Mirror/Twin Architecture** — Owner authentication (OWNER_PASSWORD), Mirror Mode (full persona cards, sharper tone), Twin Mode (unified voice, identity-redacted), server-side mergePersonasToUnifiedVoice() + redactOwnerIdentity(), system prompt PRESENTATION MODE injection, frontend lock/logout UI, adaptive empty state
- 2026-02-12: **v2.0 Phase 1 — Executive Intelligence** — Context Mode Engine (5 modes: strategic/tactical/reflection/crisis/general), Silent Tagging System, context mode UI indicator, DARVIS_CORE.md updated with context mode rules
- 2026-02-12: **v1.1 — Broto Review improvements** — anti echo-chamber, memory governor, decision fast mode, confidence tone, resource softening, strategic escalation
- 2026-02-12: **Session isolation** — setiap device/browser dapat session unik, chat history tidak bocor antar user
- 2026-02-12: Streaming SSE responses — jawaban muncul real-time kata per kata
- 2026-02-12: Prompt optimization — jawaban default singkat/tektok (2-5 kalimat), detail hanya kalau diminta
- 2026-02-12: Max completion tokens dikurangi dari 8192 ke 2048
- 2026-02-11: Added PWA support — installable on iOS (Add to Home Screen) dan Android, logo DARVIS, standalone mode
- 2026-02-11: Added Image Upload & Analysis — upload file, paste clipboard, preview, multi-image (max 5), OpenAI Vision
- 2026-02-11: Added Voice Input — tombol mic untuk speech-to-text, Bahasa Indonesia, pakai Web Speech API browser
- 2026-02-11: **v0.3 — Single Voice Default** — DARVIS now responds as one unified voice by default, multi-persona only on-demand
- 2026-02-11: Added DR aliases (Raha, Bapak, Bapa, Abah, YKW) to passive listening & profile enrichment detection
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
