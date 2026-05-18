const express = require("express");
const cors = require("cors");
const { createClient } = require("@supabase/supabase-js");

const PORT = process.env.PORT || 8080;
const HOST = process.env.HOST || "127.0.0.1";
const KEEPALIVE_KEY = process.env.KEEPALIVE_KEY || "bfrs-keepalive-2026";
const SUPABASE_URL = process.env.SUPABASE_URL || "https://tohhqssnngvavkkeqzfl.supabase.co";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || "";
const GROQ_KEY = process.env.GROQ_KEY || "";
const RESEND_KEY = process.env.RESEND_KEY || "";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const app = express();
app.use(cors({ origin: "*", methods: ["GET", "POST", "OPTIONS"] }));
app.use(express.json({ limit: "1mb" }));

app.get("/healthz", (_req, res) => {
  res.json({ ok: true, ts: new Date().toISOString() });
});

// Mirror of netlify/functions/chatbot.js
app.post("/api/chatbot", async (req, res) => {
  try {
    const { messages, system } = req.body || {};
    const upstream = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${GROQ_KEY}`,
      },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
        max_tokens: 400,
        messages: [{ role: "system", content: system }, ...messages],
      }),
    });
    const data = await upstream.json();
    res.status(upstream.status).json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Mirror of netlify/functions/send-email.js
app.post("/api/send-email", async (req, res) => {
  try {
    const payload = req.body || {};
    const upstream = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_KEY}`,
      },
      body: JSON.stringify({
        from: "BFRS Events <alerts@grabcalls.com>",
        to: payload.to,
        subject: payload.subject,
        html: payload.html,
      }),
    });
    const data = await upstream.json();
    res.status(upstream.status).json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Mirror of netlify/functions/keep-alive.js
app.get("/api/keep-alive", async (req, res) => {
  if (req.query.key !== KEEPALIVE_KEY) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  try {
    const { error } = await supabase.from("profiles").select("id").limit(1);
    if (error) throw error;
    res.json({ alive: true, pinged: new Date().toISOString(), status: 200 });
  } catch (e) {
    res.status(500).json({ alive: false, error: e.message });
  }
});

// Mirror of netlify/functions/pay-period-report.js
app.post("/api/pay-period-report", async (req, res) => {
  try {
    const { from, to } = req.body || {};
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
      const hrs =
        a.sign_in_time && a.sign_out_time
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
    res.json({ rows });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.listen(PORT, HOST, () => {
  console.log(`BFRS API listening on ${HOST}:${PORT}`);
});
