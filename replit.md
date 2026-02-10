# DARVIS - DiAn Raha Vision v0.1

## Overview
DARVIS is an AI-powered thinking companion web application with dual-persona output (Broto & Rara). Built for mas DR as a tool to help think more clearly before making decisions.

## Architecture
- **Frontend**: React + TypeScript + Tailwind CSS + shadcn/ui
- **Backend**: Express.js with OpenAI API integration
- **AI Model**: GPT-5 via OpenAI API
- **State**: localStorage for chat history (no database needed)

## Key Files
- `client/src/pages/chat.tsx` - Main chat UI page
- `server/routes.ts` - /api/chat endpoint with OpenAI integration
- `shared/schema.ts` - ChatMessage, ChatRequest, ChatResponse types
- `prompts/DARVIS_CORE.md` - Core system prompt (dual-persona rules)
- `prompts/DARVIS_NODE_SolidGroup.md` - Solid Group context node

## Features
- Single-page minimalist chat UI
- Dual-persona output: Broto (logical) & Rara (reflective)
- Intent detection for Solid Group topics (keywords: solid, rfb, bpf, kpf, ewf, sgb, etc.)
- localStorage chat history with 10-message context window
- Clear chat functionality
- Loading state indicator
- Post-processing to enforce Broto/Rara format

## Environment
- `OPENAI_API_KEY` - Required, stored in Replit Secrets

## Recent Changes
- 2026-02-10: Initial v0.1 implementation
