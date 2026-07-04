# BFRS Special Events Staffing — Claude Code Session Startup

## STEP 1: Load Master Brain (do this before anything else)
Fetch via Notion MCP:
- Master Brain: https://app.notion.com/p/3629f92593e5814ea7c8dc4e1d4c93e7
- BFRS Hub: https://app.notion.com/p/35c9f92593e5814fab94e5abc6eacb3d

Read: Inbox, Last Session Log, Active Flags before touching anything.

## STEP 2: HARD RULES — never break these
1. NEVER push directly to `main` — always use a `claude/` branch + PR
2. NEVER edit `src/App.jsx` without reading the current version first this session
3. Run `npm run preflight` before every build (it runs automatically via `prebuild`)
4. One deploy per session — batch all changes into one commit + one PR
5. End of session: write to Notion Master Brain Last Session Log

---

## Project Overview
Staffing app for Birmingham Fire and Rescue (~100 staff, ~64 events/month, biweekly pay periods).

**Status:** BFD dropping app August 2026 (Oracle Cloud ERP consolidation citywide).
**Pivot strategy:** https://app.notion.com/p/3759f92593e581bdaa2ed35594e01276

## Stack
- Frontend: React + Vite — entire app lives in `src/App.jsx`
- Database: Supabase (Postgres) — upgrade from v14 required before July 1, 2026
- Deploy: Netlify (auto-deploy from main)
- Email: Resend via `netlify/functions/send-email.js`
- Chatbot: Groq via `netlify/functions/chatbot.js`
- Keep-alive: `netlify/functions/keep-alive.js`
- Pay reports: `netlify/functions/pay-period-report.js`

## Autonomous Infrastructure Running
- GitHub Actions `health-check.yml`: daily ping at 8am CT — checks app, DB, Postgres deadline, emails grabcalls@gmail.com on issues
- All 4 Netlify functions above run server-side (no laptop needed)

## Open Draft PRs (need review before merging)
- #21: Free nightly DB backup via GitHub Actions (needs SUPABASE secrets added first)
- #23: HelpChat prompts updated + Days shift Kelly UI fix
- #24: BFRS_STATE.md briefing doc for claude.ai Project
- #25: Keep-alive cron bump 1x/day → every 6h + operator-precedence bugfix
- #26: Pivot strategy doc

## Key Domain Concepts
- A/B/C shifts + Days shift (admin, no Kelly Day)
- Kelly Day = rotating day off; skips on payday Fridays
- Biweekly pay periods with 14-day lag before check
- Event statuses: OPEN / FULL / CLOSED / CANCELLED
- Hard overlap block at approval time (staff can't work two events same time)

## Active Branch for New Work
`claude/open-claw-automation-t94y4e`

## Owner
Eric Glover | grabcalls@gmail.com | (205) 914-3390
