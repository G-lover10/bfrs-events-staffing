# BFRS Special Events Staffing — State Briefing

> **Purpose**: a self-contained snapshot of this codebase intended to be uploaded to the **claude.ai Project** ("Birmingham Fire and Rescue beta app") so the chat-product Claude has accurate context without needing to read the live repo each time.
>
> **Source of truth**: this repo on GitHub at https://github.com/g-lover10/bfrs-events-staffing (main branch). If meaningful time has passed since the date below, re-export this file by opening Claude Code on the web and asking "regenerate docs/BFRS_STATE.md".
>
> **Last regenerated**: 2026-05-19

---

## What this app is

A web app used by Birmingham Fire & Rescue Service (BFRS) to coordinate paid staffing for special events (sporting events, concerts, festivals). Built solo by Eric Glover. In use by ~100 staff today.

## Who uses it

- **Staff** (EMTs, EMT Advanced, Paramedics): sign up for events, manage their schedule, clock in/out, request withdrawals
- **Coordinators** (Chief Hendon's team): approve signups, manage events, send Outlook invites, audit attendance
- **Days shift admins** (e.g. Chief Hendon): M-F admin staff. No Kelly days. Don't sign up for events the same way.

## Stack

| Layer | Tech | Notes |
|---|---|---|
| Frontend | React + Vite (SPA) | Monolithic `src/App.jsx`, 2500+ lines, intentionally one file |
| Hosting | Netlify (free tier) | Auto-deploys from `main`. Functions served from the same site. |
| Database & Auth | Supabase (free tier) | Postgres + realtime + auth. Anon key in client, RLS expected (verify before any change). |
| Functions | Netlify Functions (Node) | `send-email`, `chatbot`, `pay-period-report`, `keep-alive`, plus shared `_security.js` |
| Email | Resend (free tier — 100/day) | Transactional |
| AI | Groq llama-3.1-8b-instant (free) | HelpChat + feedback AI review |
| Build/CI | GitHub Actions | Daily health check, planned: DB backup |

## Important URLs

- Live production: https://bfrs-events-staffing.netlify.app
- GitHub repo: https://github.com/g-lover10/bfrs-events-staffing
- Restore-point branch (known good as of May 19 2026): `restore-point-2026-05-19`
- Default coordinator email recipients: `saleen_190@yahoo.com`, `grabcalls@gmail.com`

---

## 🛑 HARD RULES for the chat-product Claude (claude.ai)

These rules exist because the claude.ai Project keeps a stale snapshot of the codebase. Code edits made there have caused real production regressions in this app — including a silent JSX corruption that stripped the entire pending-approval flow from production for hours on May 19 2026.

1. **DO NOT write or edit code.** Refuse code changes — including small ones, including "just paste this" snippets. Direct the user to Claude Code on the web at https://code.claude.com.
2. **DO NOT generate JSX, JS, or YAML diffs** even when asked.
3. **DO NOT "fix" reported bugs by writing code.** Reason about the bug verbally; defer the fix to Claude Code on the web.
4. **DO**: explain features, debug by reasoning verbally, draft non-code text (emails, docs, decisions, prose), discuss product/UX, sketch ideas in words, help with feedback for Chief Hendon.
5. **For specific code questions**, defer to the live repo. Tell the user to open the relevant file path (e.g. `src/App.jsx:1234`) in Claude Code on the web.

---

## Key domain concepts

### Shift rotation

- **A/B/C** shifts work 24 hours on, 48 hours off. The cycle rotates A → B → C.
- Each A/B/C staff member has a **Kelly Day #** (1–9) — marks which day in their 27-day rotation cycle is their off day.
- **Days** shift = M-F admin staff (Chief Hendon, etc.). NO Kelly day. The registration and profile forms hide the Kelly picker when "Days" is selected.

### Kelly Day exception ⚠️ critical

When a Kelly Day would fall on a **payday Friday**, it is canceled. The staff member must work their regular shift. Their only way off is to use vacation time. The BFRS paper calendar marks these as "No Off Day" with a "$" symbol. Implemented at `src/App.jsx:993` — the very first thing `isKellyDay()` does after sanity checks is return `false` if `isPaydayFriday(date)`.

### Pay periods

- Biweekly. Anchors: period END = May 1 2026, first payday = May 15 2026.
- **14-day lag** between period end and payday. So:
  - Period Apr 18–May 1 → paycheck May 15
  - Period Jun 13–Jun 26 → paycheck Jul 10
  - Period Jun 27–Jul 10 → paycheck Jul 24
- An event worked at the START of a fresh period feels like a 24-day wait for payment — that is **not a bug**, it's how the schedule works.

### Event statuses

`OPEN` (signups accepted), `FULL` (slots filled), `CLOSED`, `CANCELLED`

### Signup statuses

`pending` (awaiting coord approval), `confirmed` (approved), `denied`, `cancelled`

### Withdrawal flow

Confirmed staff who can't make an event tap **Cancel**. This creates a `cancel_request` row, NOT an immediate removal. Coordinator approves or denies in the **Cancel Reqs** tab. Approval reopens the slot AND triggers an "open slot" alert (in-app badge + email to eligible staff). Pending withdrawal shows a "⏳ Withdrawal Pending" badge on the staff member's view.

### Approval recommendation (⭐)

When a coordinator opens **Manage** on an event, pending signups are sorted by a scoring algorithm: credential match → not on regular duty → Kelly Day off → fewest events this month → earliest signup time. The ⭐ marks the recommendation — it's a suggestion, not a binding rule.

### Hard overlap block

Approving a signup that would put a staff member on TWO confirmed overlapping events same day is **blocked** by the app with an error toast. Prevents double-booking. See `src/App.jsx` `approveSignup` function.

---

## What ships when (recent history)

PRs #2 – #14 (April – May 2026) added the modern feature set:
- PR #5: Clickable summary cards (`.stc-link`), Payday math fix, My Hours rebuild, mobile UI polish
- PR #6: ⏳ pending account suffix in Add Staff dropdown
- PR #7: Mute cancel_request / cancel_decision emails
- PR #8: Auto-repair missing profile row on login
- PR #9: Realtime sync + version-check banner + Kelly Day wording
- PR #10: Bulletproof approve/deny error handling
- PR #11–#12: Pagination bypass for Supabase's default 1000-row cap
- PR #13: At-a-glance approval status on event cards
- PR #14: Silent failure batch — error toasts on event lifecycle + cancel + remove + deny

### May 19, 2026 work (this session)

- **PR #17 (merged)** — removed `deploy.zip` from repo (was a footgun for accidental downgrades via Netlify drag-drop)
- **PR #18 (merged)** — fixed orphan `)}` at `src/App.jsx:1623` that was silently corrupting the Vite build output. The root cause of stripped Manage section + white-screen-on-click in production.
- **PR #22 (merged)** — security hardening on Netlify Functions: domain-only CORS regex (no more `*` wildcard) + Supabase JWT auth via `_security.js` helpers + dead `VITE_RESEND_KEY` / `VITE_GROQ_KEY` client code removed
- **PR #23 (draft)** — HelpChat prompts updated for current features, split staff/coord, Kelly Day picker hidden for Days shift
- **PR #21 (draft)** — Free nightly DB backup workflow (`scripts/backup-db.mjs` + `.github/workflows/db-backup.yml`). Waiting on `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` repo secrets.

---

## Known scaling risks (audit from May 19 2026)

If anyone asks about scaling, refer to these — they are the **next 1000-row class traps** waiting to bite.

### 🔴 Critical (will bite soon)

1. **Realtime fan-out storm**: `useData()` (in `src/App.jsx`) subscribes to ALL changes on ALL 7 tables and refetches everything on each event. A bulk-approve action by one coordinator can broadcast to all clients = ~3GB egress in a single click. Supabase free tier egress = 5GB/month.
2. **30s polling on top of realtime**: 100 users idle → ~1GB/hour egress just from polling.
3. **`open_slot` email blast bug**: code computes correct staff recipients but actually sends only to hardcoded `COORDINATOR_EMAILS`. Staff never get the alerts currently.
4. **Hardcoded values requiring deploys**: `COORDINATOR_EMAILS`, May 2026 date anchors (`PAYDAY_REF`, `PERIOD_END_REF`, `KELLY_REF`).

### 🟡 Important

- N+1 patterns in coord events list (UI freezes near 150 events on mobile)
- Activity log grows unbounded AND is subscribed via realtime
- SheetJS loaded from CDN without Subresource Integrity hash (supply chain + availability risk)
- `fetchAll` has a silent 100,000-row ceiling
- Groq 30 req/min ceiling = chatbot stops responding for ~30 concurrent users

### Planned (deferred)

- **Cloudflare in front of Netlify**: useful for DDoS + edge caching, but requires a custom domain and careful page rules. Multi-week project. Not started.
- **Past-events toggle** (UI archival): hide past events behind a toggle. Issue #20 in repo.
- **Health tab cleanup**: remove "approved staff with zero signups" noise. Issue #19 in repo.
- **Payday digest email to Chief**: bi-weekly summary cron. Not yet scheduled.

---

## File structure (high level)

| Path | Purpose |
|---|---|
| `src/App.jsx` | The entire React app, 2500+ lines, monolithic by choice. Navigate by `// ─── SECTION LABEL ───` comments. |
| `src/main.jsx` | React entry point |
| `index.html` | Vite HTML template |
| `netlify/functions/_security.js` | Shared `corsHeaders()`, `verifyUser()`, `verifySystem()` helpers |
| `netlify/functions/send-email.js` | Resend wrapper (POST, requires Supabase JWT OR SYSTEM_TOKEN) |
| `netlify/functions/chatbot.js` | Groq wrapper for HelpChat + AI feedback review |
| `netlify/functions/pay-period-report.js` | Attendance roll-up (currently uncalled from client) |
| `netlify/functions/keep-alive.js` | Pings Supabase to prevent free-tier sleep |
| `scripts/write-version.mjs` | Build-time: writes `dist/version.json` for the version banner |
| `scripts/backup-db.mjs` | (pending PR #21) Dumps all tables to JSON |
| `.github/workflows/health-check.yml` | Daily 8 AM CT health check |
| `.github/workflows/db-backup.yml` | (pending PR #21) Nightly backup cron |
| `netlify.toml` | Build config: `npm run build`, publish `dist`, SPA redirect |
| `package.json` | Dependencies: @supabase/supabase-js, react, vite, xlsx |

## Locations of common things

- **HelpChat AI prompts** (staff and coord variants): `src/App.jsx` near `APP_BASICS`, `HELP_SYSTEM_PROMPT_STAFF`, `HELP_SYSTEM_PROMPT_COORD`
- **Kelly Day math**: `isKellyDay()`, `KELLY_REF` constant
- **Pay period math**: `getPaydayForDate()`, `getPayPeriodForDate()`, `PAYDAY_REF`, `PERIOD_END_REF`
- **Shift detection for any date**: `getShiftForDate()`, `SHIFT_REF_DATE`
- **Approval recommendation scoring**: `scoreSignup()`, `getRecommended()`
- **Pagination helper**: `fetchAll()` inside `useData()`
- **Realtime subscription setup**: `useData()` channel block
- **Version banner trigger**: `initialBuildRef` + 60s `setInterval` poll of `/version.json`

---

## Environment variables (configured separately, not in code)

| Name | Where set | What it is |
|---|---|---|
| `RESEND_KEY` | Netlify env | API key for transactional email |
| `GROQ_KEY` | Netlify env | API key for AI inference |
| `SUPABASE_SERVICE_KEY` | Netlify env | Used by pay-period-report + keep-alive (server-side only) |
| `SYSTEM_TOKEN` | Netlify env + GitHub repo secrets | Shared secret for GitHub Actions cron → `send-email` |
| `SUPABASE_URL` | (planned: GitHub repo secrets) | For DB backup workflow |
| `SUPABASE_SERVICE_ROLE_KEY` | (planned: GitHub repo secrets) | For DB backup workflow |

**Never store secrets in git or in the claude.ai Project files.**

---

## How Eric should request code changes

**Always via Claude Code on the web** at https://code.claude.com → open the `bfrs-events-staffing` repo → start a session. That product has full git access, can run builds, open PRs, spawn review agents, and verify deploys.

Editing code through the claude.ai chat (this product) has burned this app in the past. The session that produced this doc was specifically dealing with the aftermath of one such regression.
