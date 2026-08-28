// Server-side profile lookup, using the service-role key.
//
// Why this exists: the client used to read its own profile directly via
// supabase.from("profiles").select(...) using the anon key, gated by RLS on
// the current session. That path was proven unreliable — a session/RLS
// timing issue (exact cause still not fully pinned down) could make an
// existing, already-approved profile briefly invisible to that query. The
// old code treated "0 rows" as proof the profile was missing and rebuilt it
// with approved:false, silently de-approving real accounts. A retry-based
// patch (Aug 26) did not fix it — confirmed still recurring Aug 27.
//
// This function sidesteps the whole problem: service-role reads bypass RLS
// entirely, so there's no "is the session fully attached yet" question. The
// only thing that has to succeed is verifying the caller's JWT against
// Supabase's own /auth/v1/user endpoint (verifyUser, below) — a simpler,
// different code path than RLS policy evaluation, and the one every other
// working function in this app (password-reset, etc.) already relies on.

const { createClient } = require("@supabase/supabase-js");
const { corsHeaders, verifyUser } = require("./_security");

const supabase = createClient(
  "https://tohhqssnngvavkkeqzfl.supabase.co",
  process.env.SUPABASE_SR || process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

exports.handler = async (event) => {
  const headers = corsHeaders(event.headers?.origin || event.headers?.Origin);
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers, body: "" };
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  const authUser = await verifyUser(event.headers?.authorization || event.headers?.Authorization);
  if (!authUser) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: "Unauthorized" }) };
  }
  const uid = authUser.id;

  // maybeSingle(): returns null for 0 rows (expected for a genuinely new user) without
  // throwing. Throws only on 2+ rows, which would indicate real data corruption worth surfacing.
  const { data: existing, error: selErr } = await supabase.from("profiles").select("*").eq("id", uid).maybeSingle();
  if (selErr) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: selErr.message }) };
  }
  if (existing) {
    return { statusCode: 200, headers, body: JSON.stringify({ profile: existing, created: false }) };
  }

  // Confirmed missing via an authoritative, RLS-free read — not a guess. Safe to create fresh.
  const meta = authUser.user_metadata || {};
  // Belt-and-suspenders, now reliable: this read is server-side via service role, not subject to
  // the RLS-timing issue that made the same check unreliable when it lived client-side. If this
  // person has ever been approved before, honor that instead of defaulting to false.
  //
  // IMPORTANT: check the error here. An unchecked failure on this query would silently look
  // identical to "confirmed no history" and default to approved:false on an ambiguous result --
  // the exact same category of mistake that caused the original bug. If this query itself fails,
  // don't proceed on a guess -- fail the request so the client retries instead.
  const { data: priorApproval, error: histErr } = await supabase.from("activity_log").select("id").eq("action", "approved_account").eq("target_id", uid).limit(1);
  if (histErr) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: "history check failed: " + histErr.message }) };
  }
  const wasApprovedBefore = priorApproval && priorApproval.length > 0;
  const repaired = {
    id: uid,
    email: authUser.email || "",
    name: meta.name || "",
    level: meta.level || "",
    shift: meta.shift || "",
    phone: meta.phone || "",
    kelly_number: meta.kelly_number || null,
    role: meta.role || "staff",
    approved: wasApprovedBefore,
  };
  // insert, not upsert: if a row now exists (a concurrent request from another tab/device beat us
  // here between our SELECT and this write), a plain insert fails loudly on the conflict instead of
  // silently overwriting whatever that other request just wrote — which could include approved:true.
  const { data: created, error: insErr } = await supabase.from("profiles").insert(repaired).select().single();
  if (insErr) {
    if (insErr.code === "23505") {
      // Conflict: someone else created it a moment ago. Re-fetch and return the real row instead of erroring.
      const { data: raced, error: raceErr } = await supabase.from("profiles").select("*").eq("id", uid).single();
      if (raceErr) return { statusCode: 500, headers, body: JSON.stringify({ error: raceErr.message }) };
      return { statusCode: 200, headers, body: JSON.stringify({ profile: raced, created: false }) };
    }
    return { statusCode: 500, headers, body: JSON.stringify({ error: insErr.message }) };
  }
  // Log this — the rebuild path firing at all for an existing user is anomalous and worth a trail.
  // Best-effort: don't fail the whole request if only the log write itself has a problem.
  await supabase.from("activity_log").insert({
    action: "profile_rebuilt", target_type: "profile", target_id: uid,
    details: { name: repaired.name, email: repaired.email, restoredApproved: wasApprovedBefore },
  }).then(() => {}, () => {});
  return { statusCode: 200, headers, body: JSON.stringify({ profile: created, created: true }) };
};
