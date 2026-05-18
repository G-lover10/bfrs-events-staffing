import { corsHeaders } from "./cors.js";

export function jsonResponse(status, data, env, origin) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders(env, origin),
    },
  });
}

export function errorJson(status, message, env, origin) {
  return jsonResponse(status, { error: message }, env, origin);
}
