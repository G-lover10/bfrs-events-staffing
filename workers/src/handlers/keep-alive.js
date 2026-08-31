import { createClient } from "@supabase/supabase-js";
import { jsonResponse, errorJson } from "../lib/json.js";

export default async function keepAlive(request, env, ctx, origin) {
  const url = new URL(request.url);
  const key = url.searchParams.get("key");
  if (key !== env.KEEPALIVE_KEY) {
    return errorJson(401, "Unauthorized", env, origin);
  }

  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);
  const { error } = await supabase.from("profiles").select("id").limit(1);
  if (error) {
    return jsonResponse(500, { alive: false, error: error.message }, env, origin);
  }
  return jsonResponse(200, {
    alive: true,
    pinged: new Date().toISOString(),
    status: 200,
  }, env, origin);
}
