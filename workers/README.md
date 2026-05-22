# BFRS API Worker

Cloudflare Worker hosting the 4 backend functions for the BFRS Events Staffing app.

## Endpoints

| Route | Method | Auth | Purpose |
|---|---|---|---|
| `/chatbot` | POST | Bearer JWT (shadow-mode during cutover) | Proxy to Groq AI |
| `/send-email` | POST | Bearer JWT (shadow-mode during cutover) | Proxy to Resend |
| `/keep-alive` | GET | `?key=<KEEPALIVE_KEY>` | Supabase ping (public-style) |
| `/pay-period-report` | POST | Bearer JWT + coordinator role | Attendance report |

## First-time setup

1. Install wrangler locally and authenticate:
   ```
   cd workers
   npm install
   npx wrangler login
   ```
2. Set the 3 secrets (paste each value when prompted):
   ```
   npx wrangler secret put GROQ_KEY
   npx wrangler secret put RESEND_KEY
   npx wrangler secret put SUPABASE_SERVICE_KEY
   ```
3. Deploy:
   ```
   npx wrangler deploy
   ```
4. Test the keep-alive endpoint (no auth needed):
   ```
   curl https://bfrs-api.<your-cf-subdomain>.workers.dev/keep-alive?key=bfrs-keepalive-2026
   ```

## Auth modes

The `AUTH_MODE` env var in `wrangler.toml` controls auth behavior on `/chatbot`, `/send-email`, `/pay-period-report`:

- `shadow` (default) — logs missing/invalid Bearer header to `wrangler tail` but returns 200. Use this while the frontend cutover is in progress so missing headers don't break production.
- `enforce` — returns 401 on missing/invalid auth. Switch to this only after 24h+ of clean shadow logs confirms every legitimate caller is sending the header.

To switch: edit `wrangler.toml`, change `AUTH_MODE = "shadow"` to `AUTH_MODE = "enforce"`, then `npx wrangler deploy`.

## Chatbot kill switch (AI separation)

Set `ENABLE_CHATBOT = "false"` in `wrangler.toml` and redeploy. `/chatbot` will return 503 with `{"error":"Chatbot is disabled"}`. Frontend should hide the chat UI when it sees a 503. Other 3 endpoints unaffected.

## Live tail of logs

```
npx wrangler tail
```

Tail shows every request's logs. Particularly useful during shadow mode to spot any missing Bearer headers.

## How traffic flows

```
Browser
  → bfrs-events-staffing.netlify.app/.netlify/functions/<name>
  → (Netlify rewrite — see netlify.toml)
  → bfrs-api.<account>.workers.dev/<name>
  → handler in src/handlers/<name>.js
  → upstream API (Groq / Resend / Supabase)
```

The frontend never knows about the workers.dev URL. The rewrite makes the migration transparent.

## Rollback (under 60 seconds)

Revert the redirect commit in `netlify.toml`. The original Netlify Functions at `/netlify/functions/*.js` are still on disk and will resume serving traffic within ~60s of Netlify rebuild. The Worker keeps running harmlessly — it just stops receiving traffic.

## Handover to new owner (BFRS IT)

1. New owner creates their own Cloudflare account and runs `npx wrangler login`
2. From the cloned repo: `npx wrangler secret put` for GROQ_KEY, RESEND_KEY, SUPABASE_SERVICE_KEY (they regenerate these in their own Groq / Resend / Supabase accounts)
3. `npx wrangler deploy` — Worker now lives at the new account's `workers.dev` URL
4. Update `netlify.toml` redirect to point at the new URL
5. Old account's Worker can be deleted

No code changes needed for handover. The chatbot kill switch ensures BFRS can disable AI without touching code.
