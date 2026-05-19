// Shared security helpers for Netlify Functions.
// CORS: only allow our own Netlify subdomains (production, branch deploys, deploy previews).
// Auth: verify a Supabase user JWT by hitting Supabase's /auth/v1/user endpoint.

const SUPABASE_URL = "https://tohhqssnngvavkkeqzfl.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRvaGhxc3Nubmd2YXZra2VxemZsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ1NDg2NTAsImV4cCI6MjA5MDEyNDY1MH0.3mma-zOBQ63AM7FgHjRrKrnB_MX1FljnJPCrpmAMbIc";

// Production + branch deploys + deploy previews all live under *.netlify.app.
const ALLOWED_ORIGIN_RE = /^https:\/\/(bfrs-events-staffing|[\w-]+--bfrs-events-staffing)\.netlify\.app$/;
const FALLBACK_ORIGIN = "https://bfrs-events-staffing.netlify.app";

function corsHeaders(origin) {
  const allowed = ALLOWED_ORIGIN_RE.test(origin || "") ? origin : FALLBACK_ORIGIN;
  return {
    "Access-Control-Allow-Origin": allowed,
    "Vary": "Origin",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
  };
}

async function verifyUser(authHeader) {
  if (!authHeader) return null;
  const token = String(authHeader).replace(/^Bearer\s+/i, "");
  if (!token) return null;
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: SUPABASE_ANON_KEY },
    });
    if (res.status !== 200) return null;
    return await res.json();
  } catch {
    return null;
  }
}

module.exports = { corsHeaders, verifyUser };
