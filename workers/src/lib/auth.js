import { createClient } from "@supabase/supabase-js";

const roleCache = new Map();
const ROLE_CACHE_TTL_MS = 5 * 60 * 1000;

export async function verifyBearer(request, env) {
  const auth = request.headers.get("Authorization") || "";
  if (!auth.startsWith("Bearer ")) {
    return { ok: false, reason: "missing_bearer" };
  }
  const token = auth.slice(7);
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) {
    return { ok: false, reason: "invalid_jwt", detail: error?.message };
  }
  return { ok: true, userId: data.user.id, email: data.user.email };
}

export async function verifyCoordinator(request, env) {
  const bearer = await verifyBearer(request, env);
  if (!bearer.ok) return bearer;

  const cached = roleCache.get(bearer.userId);
  if (cached && cached.expiresAt > Date.now()) {
    if (cached.role !== "coordinator") return { ok: false, reason: "not_coordinator" };
    return { ok: true, userId: bearer.userId, role: "coordinator" };
  }

  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);
  const { data, error } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", bearer.userId)
    .single();

  if (error || !data) return { ok: false, reason: "profile_lookup_failed", detail: error?.message };

  roleCache.set(bearer.userId, { role: data.role, expiresAt: Date.now() + ROLE_CACHE_TTL_MS });

  if (data.role !== "coordinator") return { ok: false, reason: "not_coordinator" };
  return { ok: true, userId: bearer.userId, role: "coordinator" };
}

export function shadowOrEnforce(env, authResult, route) {
  const mode = (env.AUTH_MODE || "enforce").toLowerCase();
  if (authResult.ok) return null;
  if (mode === "shadow") {
    console.warn(`[shadow-auth] ${route}: ${authResult.reason}${authResult.detail ? ` (${authResult.detail})` : ""}`);
    return null;
  }
  return { status: 401, reason: authResult.reason };
}
