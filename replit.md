# DARVIS - DiAn Raha Vision v0.1

## Overview
DARVIS is an AI-powered thinking companion web application with dual-persona output (Broto & Rara). Built for mas DR as a tool to help think more clearly before making decisions.

## User Preferences
- **Bahasa**: Selalu gunakan Bahasa Indonesia untuk semua komunikasi dan respons. Jangan campur dengan bahasa Inggris supaya tidak salah tafsir.

## Architecture
- **Frontend**: React + TypeScript + Tailwind CSS + shadcn/ui
- **Backend**: Express.js with OpenAI API integration
- **AI Model**: GPT-5 via OpenAI API
- **State**: Server-side SQLite (better-sqlite3) for persistent chat history + auto-summary
- **Database**: darvis.db (SQLite, WAL mode)

## Key Files
- `client/src/pages/chat.tsx` - Main chat UI page
- `server/routes.ts` - /api/chat endpoint with OpenAI integration
- `shared/schema.ts` - ChatMessage, ChatRequest, ChatResponse types
- `prompts/DARVIS_CORE.md` - Core system prompt (dual-persona rules)
- `prompts/DARVIS_NODE_SolidGroup.md` - Solid Group context node
- `prompts/DARVIS_NODE_BIAS.md` - Behavioral bias & emotional context node
- `prompts/DARVIS_NODE_AiSG.md` - Audit intelligence & governance context node
- `prompts/DARVIS_NODE_NM.md` - Market intelligence & data authority context node
- `prompts/DARVIS_NODE_RISK_GUARD.md` - Risk education & mitigation context node

## Features
- Single-page minimalist chat UI
- Dual-persona output: Broto (logical) & Rara (reflective)
- Intent detection for Solid Group topics (keywords: solid, rfb, bpf, kpf, ewf, sgb, etc.)
- Intent detection for behavioral/emotional bias (keywords: ragu, fomo, burnout, stres, overconfidence, etc. + NLP regex patterns)
- Intent detection for audit/governance (keywords: audit, evaluasi, kinerja, cabang, governance, ews, etc. + NLP regex patterns)
- Intent detection for market/data (keywords: harga, emas, gold, oil, market, inflasi, the fed, trading, etc. + NLP regex patterns)
- Intent detection for risk education (keywords: risiko, martingale, leverage, margin, drawdown, loss, money management, etc. + NLP regex patterns)
- Multi-node support: NODE_BIAS prioritized for refleksi awal when multiple nodes detected
- Fallback: if ragu market vs risiko, prioritaskan NODE_RISK_GUARD
- Server-side SQLite persistent chat history with 10-message context window + auto-summary
- Auto-learn system: AI-powered preference extraction every 10 messages
- Learned preferences injected into system prompt for personalized responses
- Preferences panel (lightbulb icon) to view what DARVIS has learned
- Clear chat functionality (also clears learned preferences)
- Loading state indicator
- Post-processing to enforce Broto/Rara format

## Node System
- **NODE_SOLIDGROUP**: Solid Group business context (triggered by company/product keywords)
- **NODE_BIAS**: Behavioral intelligence & human risk (triggered by emotional/bias keywords + regex patterns)
- **NODE_AiSG**: Audit intelligence & governance (triggered by audit/evaluasi/kinerja/governance keywords + regex patterns)
- **NODE_NM**: Market intelligence & data authority (triggered by market/harga/ekonomi keywords + regex patterns)
- **NODE_RISK_GUARD**: Risk education & mitigation (triggered by risiko/martingale/leverage/margin/drawdown keywords + regex patterns)
- Priority: NODE_BIAS > NODE_RISK_GUARD > NODE_NM > other nodes
- When RISK_GUARD + NM both detected: NM becomes subordinate to RISK_GUARD
- Multi-node without BIAS: turunkan klaim, bahasa reflektif, no penilaian final
- Node injection order: BIAS (priority) → RISK_GUARD → NM → AiSG → SOLIDGROUP

## Environment
- `OPENAI_API_KEY` - Required, stored in Replit Secrets

## Auto-Learn System
- **Trigger**: Every 10 messages, AI extracts user preferences from recent conversations
- **Categories**: gaya_berpikir, preferensi_komunikasi, konteks_bisnis, pola_keputusan, area_fokus, koreksi_penting
- **Storage**: learned_preferences table in SQLite
- **Injection**: Preferences injected into system prompt as AUTO-LEARN block
- **UI**: Lightbulb icon in header → panel showing learned insights grouped by category
- **Clear**: Clearing chat also clears all learned preferences
- **Endpoints**: GET /api/preferences (view), POST /api/clear (reset all)

## Recent Changes
- 2026-02-11: Enriched NODE_AiSG v0.2 with curated knowledge from AiSG (18 Pilar framework, zona kinerja, ProDem, Reality Score gap, EWS, SWOT, action plan 30-60-90, coaching knowledge — all framed as reflective tools)
- 2026-02-11: Enriched NODE_BIAS v0.2 with curated knowledge from BiAS Pro (cognitive bias catalog 23 items, decision frameworks 6 models, teknik debiasing 7 metode, pola emosional, template refleksi, warmth index)
- 2026-02-11: Enriched NODE_NM v0.2 with curated knowledge from Gwen Stacy/NM AI (technical analysis, fundamental analysis, instrument characteristics, trading strategies education, korelasi, sentimen)
- 2026-02-11: Enriched NODE_RISK_GUARD v0.2 with curated knowledge from Gwen Stacy/NM AI (money management, psychology, cognitive biases, common mistakes, SPA trading concepts, regulasi & perlindungan)
- 2026-02-10: Added Auto-Learn system with AI-powered preference extraction and injection
- 2026-02-10: Added NODE_RISK_GUARD support with risk education keyword + NLP detection, fallback priority over NM
- 2026-02-10: Added NODE_NM support with market/data keyword + NLP detection
- 2026-02-10: Added NODE_AiSG support with audit/governance keyword + NLP detection, multi-node logic
- 2026-02-10: Added NODE_BIAS support with keyword + NLP pattern detection, multi-node priority
- 2026-02-10: Initial v0.1 implementation
