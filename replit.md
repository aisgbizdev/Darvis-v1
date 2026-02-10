# DARVIS - DiAn Raha Vision v0.1

## Overview
DARVIS is an AI-powered thinking companion web application with dual-persona output (Broto & Rara). Built for mas DR as a tool to help think more clearly before making decisions.

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
- localStorage chat history with 10-message context window
- Clear chat functionality
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

## Recent Changes
- 2026-02-10: Added NODE_RISK_GUARD support with risk education keyword + NLP detection, fallback priority over NM
- 2026-02-10: Added NODE_NM support with market/data keyword + NLP detection
- 2026-02-10: Added NODE_AiSG support with audit/governance keyword + NLP detection, multi-node logic
- 2026-02-10: Added NODE_BIAS support with keyword + NLP pattern detection, multi-node priority
- 2026-02-10: Initial v0.1 implementation
