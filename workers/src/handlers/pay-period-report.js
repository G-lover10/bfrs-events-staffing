import { createClient } from "@supabase/supabase-js";
import { jsonResponse, errorJson } from "../lib/json.js";
import { verifyCoordinator, shadowOrEnforce } from "../lib/auth.js";

export default async function payPeriodReport(request, env, ctx, origin) {
  const auth = await verifyCoordinator(request, env);
  const block = shadowOrEnforce(env, auth, "POST /pay-period-report");
  if (block) return errorJson(block.status, block.reason, env, origin);

  let payload;
  try {
    payload = await request.json();
  } catch {
    return errorJson(400, "Invalid JSON", env, origin);
  }

  const { from, to } = payload || {};
  if (!from || !to) {
    return errorJson(400, "from and to are required (ISO datetime strings)", env, origin);
  }

  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);
  const [{ data: attendance }, { data: profiles }, { data: events }] = await Promise.all([
    supabase
      .from("attendance")
      .select("staff_id, event_id, sign_in_time, sign_out_time")
      .gte("sign_in_time", from)
      .lte("sign_in_time", to),
    supabase.from("profiles").select("id, name, level, shift"),
    supabase.from("events").select("id, name, date"),
  ]);

  const rows = (attendance || []).map(a => {
    const p = profiles?.find(x => x.id === a.staff_id);
    const e = events?.find(x => x.id === a.event_id);
    const hrs = a.sign_in_time && a.sign_out_time
      ? ((new Date(a.sign_out_time) - new Date(a.sign_in_time)) / 3600000).toFixed(2)
      : "0.00";
    return {
      name: p?.name || "?",
      level: p?.level || "?",
      shift: p?.shift || "?",
      event: e?.name || "?",
      date: e?.date || "?",
      clockIn: a.sign_in_time,
      clockOut: a.sign_out_time || "",
      hours: hrs,
    };
  });

  return jsonResponse(200, { rows }, env, origin);
}
