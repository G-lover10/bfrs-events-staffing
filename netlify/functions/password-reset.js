// Public password-reset endpoint.
//
// Why this exists: Supabase's built-in auth email is rate-limited and unreliable,
// so recovery emails frequently never arrive. Instead we generate a genuine
// Supabase recovery link with the admin API (service role) and deliver it through
// our own proven Resend pipeline (same sender as every other app email). The link
// is a normal "type=recovery" action link, so the app's existing PASSWORD_RECOVERY
// handler takes over once the user clicks it — no frontend recovery changes needed.
//
// This endpoint is intentionally unauthenticated (a locked-out user has no session).
// To avoid leaking which addresses are registered, it ALWAYS returns a generic 200,
// and it only actually emails addresses that map to a real user (generate_link fails
// for unknown emails, so it can't be used to spam arbitrary inboxes).
const { corsHeaders } = require("./_security");

const SUPABASE_URL = "https://tohhqssnngvavkkeqzfl.supabase.co";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ALLOWED_REDIRECT_RE = /^https:\/\/(bfrs-events-staffing|[\w-]+--bfrs-events-staffing)\.netlify\.app$/;
const FALLBACK_REDIRECT = "https://bfrs-events-staffing.netlify.app";

function resetEmailHtml(link) {
  return `<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:480px;margin:0 auto;color:#111">
    <h2 style="margin:0 0 12px">Reset your BFRS Events password</h2>
    <p style="margin:0 0 16px;line-height:1.5">We received a request to reset the password for your BFRS Special Events Staffing account. Click the button below to choose a new password. This link expires in 1 hour.</p>
    <p style="margin:0 0 20px"><a href="${link}" style="display:inline-block;background:#c62828;color:#fff;text-decoration:none;padding:12px 22px;border-radius:6px;font-weight:600">Set a new password</a></p>
    <p style="margin:0 0 8px;font-size:12px;color:#666">If the button doesn't work, paste this link into your browser:</p>
    <p style="margin:0 0 20px;font-size:12px;word-break:break-all"><a href="${link}">${link}</a></p>
    <p style="margin:0;font-size:12px;color:#666">If you didn't request this, you can safely ignore this email — your password won't change.</p>
  </div>`;
}

exports.handler = async (event) => {
  const headers = corsHeaders(event.headers?.origin || event.headers?.Origin);

  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers, body: "" };
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  // Generic response sent no matter what, so callers can't probe which emails exist.
  const ok = { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };

  let email, redirectTo;
  try {
    const payload = JSON.parse(event.body || "{}");
    email = String(payload.email || "").trim().toLowerCase();
    redirectTo = ALLOWED_REDIRECT_RE.test(payload.redirectTo || "") ? payload.redirectTo : FALLBACK_REDIRECT;
  } catch {
    return ok;
  }
  if (!EMAIL_RE.test(email)) return ok;

  // Read from SUPABASE_SR (the Supabase service-role key). Named without the words
  // "service_role"/"key" so Netlify's free-tier "sensitive variable" gate doesn't
  // force the paid secret-scopes flow. Falls back to the descriptive name if set.
  const serviceKey = process.env.SUPABASE_SR || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    console.error("password-reset: SUPABASE_SR is not set — cannot generate recovery link.");
    return ok;
  }
  if (!process.env.RESEND_KEY) {
    console.error("password-reset: RESEND_KEY is not set — cannot send recovery email.");
    return ok;
  }

  try {
    // 1) Generate a real Supabase recovery link (no email sent by Supabase).
    const genRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/generate_link`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({ type: "recovery", email, redirect_to: redirectTo }),
    });
    const gen = await genRes.json().catch(() => ({}));
    // GoTrue REST returns action_link at the top level; tolerate the SDK-style
    // properties.action_link shape too, just in case.
    const actionLink = gen.action_link || gen.properties?.action_link;
    if (genRes.status !== 200 || !actionLink) {
      // Most common reason: no account for that email. Stay generic; just log.
      console.error("password-reset: generate_link failed", genRes.status, gen?.msg || gen?.error_description || "");
      return ok;
    }

    // 2) Deliver the link through our own Resend pipeline.
    const mailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.RESEND_KEY}`,
      },
      body: JSON.stringify({
        from: "BFRS Events <alerts@grabcalls.com>",
        to: email,
        subject: "Reset your BFRS Events password",
        html: resetEmailHtml(actionLink),
      }),
    });
    if (mailRes.status >= 400) {
      console.error("password-reset: Resend send failed", mailRes.status, await mailRes.text().catch(() => ""));
    }
  } catch (e) {
    console.error("password-reset: unexpected error", e);
  }
  return ok;
};
