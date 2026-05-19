const { createClient } = require("@supabase/supabase-js");
const { corsHeaders, verifyUser } = require("./_security");

const supabase = createClient(
  "https://tohhqssnngvavkkeqzfl.supabase.co",
  process.env.SUPABASE_SERVICE_KEY || ""
);

exports.handler = async (event) => {
  const headers = corsHeaders(event.headers?.origin || event.headers?.Origin);

  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers, body: "" };
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers, body: JSON.stringify({ error: "Method Not Allowed" }) };
  }

  const user = await verifyUser(event.headers?.authorization || event.headers?.Authorization);
  if (!user) return { statusCode: 401, headers, body: JSON.stringify({ error: "Unauthorized" }) };

  try {
    const { from, to } = JSON.parse(event.body || "{}");
    const { data: attendance } = await supabase
      .from("attendance")
      .select("staff_id, event_id, sign_in_time, sign_out_time")
      .gte("sign_in_time", from)
      .lte("sign_in_time", to);
    const { data: profiles } = await supabase.from("profiles").select("id, name, level, shift");
    const { data: events } = await supabase.from("events").select("id, name, date");
    const rows = (attendance || []).map((a) => {
      const p = profiles?.find((x) => x.id === a.staff_id);
      const e = events?.find((x) => x.id === a.event_id);
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
    return { statusCode: 200, headers, body: JSON.stringify({ rows }) };
  } catch (e) {
    console.error("pay-period-report failed:", e);
    return { statusCode: 500, headers, body: JSON.stringify({ error: "Internal error" }) };
  }
};
