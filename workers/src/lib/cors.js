export function isAllowedOrigin(env, origin) {
  if (!origin) return false;
  const allowed = (env.ALLOWED_ORIGINS || "").split(",").map(s => s.trim()).filter(Boolean);
  return allowed.includes(origin);
}

export function corsHeaders(env, origin) {
  const allow = isAllowedOrigin(env, origin) ? origin : "";
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

export function preflightResponse(env, origin) {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(env, origin),
  });
}
