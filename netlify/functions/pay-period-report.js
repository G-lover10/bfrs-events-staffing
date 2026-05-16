const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  "https://tohhqssnngvavkkeqzfl.supabase.co",
  process.env.SUPABASE_SERVICE_KEY || "process.env.SUPABASE_SERVICE_KEY"
);

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method Not Allowed" };
  try {
    const { from, to } = JSON.parse(event.body || "{}");
    const { data: attendance } = await supabase
      .from("attendance")
      .select("staff_id, event_id, sign_in_time, sign_out_time")
      .gte("sign_in_time", from)
      .lte("sign_in_time", to);
    const { data: profiles } = await supabase.from("profiles").select("id, name, level, shift");
    const { data: events } = await supabase.from("events").select("id, name, date");
    const rows = (attendance || []).map(a => {
      const p = profiles?.find(x => x.id === a.staff_id);
      const e = events?.find(x => x.id === a.event_id);
      const hrs = a.sign_in_time && a.sign_out_time
        ? ((new Date(a.sign_out_time) - new Date(a.sign_in_time)) / 3600000).toFixed(2)
        : "0.00";
      return { name: p?.name || "?", level: p?.level || "?", shift: p?.shift || "?", event: e?.name || "?", date: e?.date || "?", clockIn: a.sign_in_time, clockOut: a.sign_out_time || "", hours: hrs };
    });
    return { statusCode: 200, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rows }) };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
