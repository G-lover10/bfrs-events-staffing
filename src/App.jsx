import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { createClient } from "@supabase/supabase-js";

// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║  BFRS Special Events Staffing v0.4 — Supabase Edition                       ║
// ║  Replace YOUR_SUPABASE_URL and YOUR_SUPABASE_ANON_KEY below                 ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

const SUPABASE_URL = "https://tohhqssnngvavkkeqzfl.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRvaGhxc3Nubmd2YXZra2VxemZsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ1NDg2NTAsImV4cCI6MjA5MDEyNDY1MH0.3mma-zOBQ63AM7FgHjRrKrnB_MX1FljnJPCrpmAMbIc";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const APP_VERSION = "0.5.0";
const SOFT_LIMIT = 4;
const BADGE_SRC = "/badge.jpg";
const SIGNUP_STATUS = {pending:{label:"⏳ Pending",cls:"pc"},confirmed:{label:"✅ Approved",cls:"si"},denied:{label:"❌ Denied",cls:"dn"}};

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const nowISO = () => new Date().toISOString();
const fmtDate = (d) => { if (!d) return "—"; const dt = new Date(d + "T00:00:00"); return dt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }); };
const fmtTime = (t) => { if (!t) return ""; const [h, m] = t.split(":"); const hr = parseInt(h); return `${hr > 12 ? hr - 12 : hr || 12}:${m} ${hr >= 12 ? "PM" : "AM"}`; };
const fmtDateTime = (iso) => { if (!iso) return "—"; const d = new Date(iso); return d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }); };
const fmtFull = (iso) => { if (!iso) return "—"; const d = new Date(iso); return d.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", second: "2-digit" }); };
const calcHours = (inT, outT) => { if (!inT || !outT) return "0.0"; return ((new Date(outT) - new Date(inT)) / 3600000).toFixed(1); };

// ─── SHIFT CALCULATOR (24 on, 48 off: A→B→C) ─────────────────────────────────
// Reference: March 26, 2026 = C shift
const SHIFT_REF_DATE = new Date("2026-03-26T00:00:00");
const SHIFT_ORDER = ["C", "A", "B"];
const NEXT_SHIFT = { A: "B", B: "C", C: "A" }; // A works → gets off 0800 on B day, etc.

// ─── TIME OVERLAP CHECKER ─────────────────────────────────────────────────────
const timesOverlap = (date1, start1, end1, date2, start2, end2) => {
  if (date1 !== date2) return false;
  return start1 < end2 && start2 < end1;
};
const findConflicts = (eventId, staffId, events, signups) => {
  const ev = events.find(e => e.id === eventId);
  if (!ev) return [];
  const confirmedSignups = signups.filter(s => s.staff_id === staffId && s.status === "confirmed" && s.event_id !== eventId);
  return confirmedSignups.map(s => {
    const other = events.find(e => e.id === s.event_id);
    if (!other) return null;
    if (timesOverlap(ev.date, ev.time_start, ev.time_end, other.date, other.time_start, other.time_end)) return other;
    return null;
  }).filter(Boolean);
};
// Shows ALL overlapping signups (pending + confirmed) for coordinator context
const findAllOverlaps = (eventId, staffId, events, signups) => {
  const ev = events.find(e => e.id === eventId);
  if (!ev) return [];
  const otherSignups = signups.filter(s => s.staff_id === staffId && (s.status === "confirmed" || s.status === "pending") && s.event_id !== eventId);
  return otherSignups.map(s => {
    const other = events.find(e => e.id === s.event_id);
    if (!other) return null;
    if (timesOverlap(ev.date, ev.time_start, ev.time_end, other.date, other.time_start, other.time_end)) return { ...other, signupStatus: s.status };
    return null;
  }).filter(Boolean);
};
const getShiftForDate = (dateStr) => {
  const d = new Date(dateStr + "T00:00:00");
  const diff = Math.round((d - SHIFT_REF_DATE) / 86400000);
  return SHIFT_ORDER[((diff % 3) + 3) % 3];
};

const STATUS_COLORS = { open: "#22c55e", full: "#f59e0b", closed: "#8899aa", cancelled: "#ef4444" };
const STATUS_LABELS = { open: "Open", full: "Full", closed: "Closed", cancelled: "Cancelled" };

// ─── EMAIL NOTIFICATION ──────────────────────────────────────────────────────
const EMAIL_ENABLED = true;
const RESEND_API_KEY = import.meta.env.VITE_RESEND_KEY || "";
const COORDINATOR_EMAILS = ["saleen_190@yahoo.com", "grabcalls@gmail.com", "medicglover@gmail.com"];

const EMAIL_TEMPLATES = {
  new_registration: d => ({
    subject: `🔔 New Staff Registration — ${d.name}`,
    html: `<p><b>${d.name}</b> has registered and is pending approval.</p><p>Level: ${d.level} | Shift: ${d.shift} | Phone: ${d.phone}</p><p>Log in to the app to approve or deny.</p>`
  }),
  account_approved: d => ({
    subject: `✅ Account Approved — ${d.name}`,
    html: `<p><b>${d.name}</b>'s account has been approved. They can now log in.</p>`
  }),
  event_signup: d => ({
    subject: `📋 New Signup — ${d.eventName}`,
    html: `<p><b>${d.staffName}</b> (${d.staffLevel}) signed up for <b>${d.eventName}</b> on ${d.eventDate}.</p>`
  }),
  cancel_request: d => ({
    subject: `⚠️ Withdrawal Request — ${d.staffName}`,
    html: `<p><b>${d.staffName}</b> has requested to withdraw from <b>${d.eventName}</b>.</p><p>Log in to the app to approve or deny the withdrawal.</p>`
  }),
  cancel_decision: d => ({
    subject: `${d.decision === "approved" ? "✅" : "❌"} Withdrawal ${d.decision} — ${d.staffName}`,
    html: `<p>The withdrawal request from <b>${d.staffName}</b> for <b>${d.eventName}</b> has been <b>${d.decision}</b>.</p>`
  }),
  overlap_alert: d => ({
    subject: `⚠️ Time Conflict — ${d.staffName} on ${d.eventDate}`,
    html: `<p><b>Cannot approve ${d.staffName}</b> for <b>${d.newEvent}</b>.</p><p>They are already confirmed for <b>${d.existingEvent}</b> (${d.existingTime}) which overlaps on ${d.eventDate}.</p>`
  }),
};

const sendNotification = async (type, data) => {
  if (!EMAIL_ENABLED) return;
  try {
    const tpl = EMAIL_TEMPLATES[type]?.(data);
    if (!tpl) return;
    await fetch("/.netlify/functions/send-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to: COORDINATOR_EMAILS, subject: tpl.subject, html: tpl.html }),
    });
  } catch (e) { /* silent — email is optional */ }
};

// ─── ACTIVITY LOGGER ─────────────────────────────────────────────────────────
const logActivity = async (action, targetType, targetId, details = {}) => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("activity_log").insert({
      actor_id: user.id, action, target_type: targetType,
      target_id: String(targetId), details,
    });
  } catch (e) { /* silent */ }
};

// ─── CSV EXPORT ───────────────────────────────────────────────────────────────
const downloadCSV = (filename, headers, rows) => {
  const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const csv = [headers.map(esc).join(","), ...rows.map(r => r.map(esc).join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
};

// ─── SHEETJS LOADER ──────────────────────────────────────────────────────────
let _xlsx = null;
const loadSheetJS = () => {
  if (_xlsx) return Promise.resolve(_xlsx);
  return new Promise((res, rej) => {
    const s = document.createElement("script");
    s.src = "https://cdn.sheetjs.com/xlsx-0.20.1/package/dist/xlsx.full.min.js";
    s.onload = () => { _xlsx = window.XLSX; res(_xlsx); };
    s.onerror = () => rej(new Error("Failed to load SheetJS"));
    document.head.appendChild(s);
  });
};

const parseExcelToEvents = (wb) => {
  const XLSX = window.XLSX;
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const events = []; const errors = [];

  // Detect format: check if row 1 has dates across columns (calendar grid)
  const range = XLSX.utils.decode_range(sheet["!ref"] || "A1");
  const firstRowVals = [];
  for (let c = range.s.c; c <= range.e.c; c++) {
    const cell = sheet[XLSX.utils.encode_cell({ r: 0, c })];
    firstRowVals.push(cell ? cell.v : null);
  }
  const dateCount = firstRowVals.filter(v => v instanceof Date || (typeof v === "number" && v > 40000 && v < 60000)).length;
  const isCalendarGrid = dateCount >= 5;

  if (isCalendarGrid) {
    // ── CALENDAR GRID FORMAT (BFRS style) ──
    // Each column = a date, events stacked in rows underneath
    const timeRx = /^(\d{3,4})\s*-\s*(\d{3,4})$/;
    const skipWords = ["none", "oooooo", "tbd", ""];
    const dayNames = ["monday","tuesday","wednesday","thursday","friday","saturday","sunday"];
    const shifts = ["a","b","c"];

    const fmtTime = (t) => {
      const s = t.padStart(4, "0");
      return s.slice(0, 2) + ":" + s.slice(2);
    };

    for (let c = range.s.c; c <= range.e.c; c++) {
      // Row 0 = date
      const dateCell = sheet[XLSX.utils.encode_cell({ r: 0, c })];
      if (!dateCell) continue;
      let dateVal = dateCell.v;
      let fDate;
      if (dateVal instanceof Date) {
        fDate = dateVal.toISOString().split("T")[0];
      } else if (typeof dateVal === "number" && dateVal > 40000) {
        const d = new Date((dateVal - 25569) * 86400000);
        fDate = d.toISOString().split("T")[0];
      } else continue;

      // Scan rows for event names and times
      const cellData = [];
      for (let r = 1; r <= range.e.r; r++) {
        const cell = sheet[XLSX.utils.encode_cell({ r, c })];
        const val = cell ? String(cell.v).trim() : "";
        cellData.push({ row: r, val });
      }

      // Find events: non-empty cells that aren't day names, shifts, times, or skip words
      for (let i = 0; i < cellData.length; i++) {
        const { val } = cellData[i];
        if (!val || skipWords.includes(val.toLowerCase())) continue;
        if (dayNames.includes(val.toLowerCase())) continue;
        if (shifts.includes(val.toLowerCase())) continue;
        if (timeRx.test(val)) continue;

        // This looks like an event name — find its time in next 1-4 rows
        let timeStart = "00:00", timeEnd = "23:59";
        for (let j = i + 1; j < Math.min(i + 5, cellData.length); j++) {
          const m = timeRx.exec(cellData[j].val);
          if (m) {
            timeStart = fmtTime(m[1]);
            timeEnd = fmtTime(m[2]);
            break;
          }
        }

        // Extract venue from "Event @ Venue" pattern
        let name = val, venue = "";
        const atIdx = val.indexOf(" @ ");
        if (atIdx > -1) {
          name = val.substring(0, atIdx).trim();
          venue = val.substring(atIdx + 3).trim();
        }

        events.push({
          name, date: fDate, time_start: timeStart, time_end: timeEnd,
          location: "", venue, notes: "", status: "open",
          needed_paramedics: 0, needed_emts: 0
        });
      }
    }
  } else {
    // ── TABLE FORMAT (standard rows with headers) ──
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
    rows.forEach((r, i) => {
      const name = r["Event Name"] || r["name"] || r["Name"] || "";
      const date = r["Date"] || r["date"] || "";
      const timeStart = r["Start Time"] || r["time_start"] || r["Start"] || "";
      const timeEnd = r["End Time"] || r["time_end"] || r["End"] || "";
      const location = r["Location"] || r["location"] || "";
      const venue = r["Venue"] || r["venue"] || "";
      const notes = r["Notes"] || r["notes"] || "";
      const np = parseInt(r["Paramedics Needed"] || r["needed_paramedics"] || r["Paramedics"] || 0);
      const ne = parseInt(r["EMTs Needed"] || r["needed_emts"] || r["EMTs"] || 0);
      if (!name || !date) { errors.push(`Row ${i + 2}: missing name or date`); return; }
      let fDate = date;
      if (typeof date === "number") {
        const d = new Date((date - 25569) * 86400000);
        fDate = d.toISOString().split("T")[0];
      }
      events.push({ name, date: fDate, time_start: timeStart || "00:00", time_end: timeEnd || "23:59",
        location, venue, notes, status: "open", needed_paramedics: np || 0, needed_emts: ne || 0 });
    });
  }

  return { events, errors };
};

// ─── CSS ──────────────────────────────────────────────────────────────────────
const css = `
@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@400;500;600;700&family=DM+Mono:wght@400;500&display=swap');
*{margin:0;padding:0;box-sizing:border-box}
:root{--bg:#0a0e14;--s:#111820;--s2:#182030;--bd:#1e2a3a;--t:#e8edf3;--t2:#8899aa;--a:#00d4ff;--a2:#0099cc;--g:#22c55e;--r:#ef4444;--o:#f59e0b;--y:#ffd166;--p:#a78bfa}
[data-theme="light"]{--bg:#f0f2f5;--s:#ffffff;--s2:#e8ecf1;--bd:#d1d9e0;--t:#1a2332;--t2:#5a6a7a;--a:#0088cc;--a2:#006699;--g:#16a34a;--r:#dc2626;--o:#d97706;--y:#b45309;--p:#7c3aed}
[data-theme="light"] body{background:var(--bg);color:var(--t)}
[data-theme="light"] .fi,[data-theme="light"] .ta,[data-theme="light"] .sel{background:var(--s2);border-color:var(--bd);color:var(--t)}
[data-theme="light"] .nf.ok{color:#fff}[data-theme="light"] .nf.wr{color:#fff}
.theme-btn{background:none;border:1px solid var(--bd);color:var(--t2);font-size:16px;width:32px;height:32px;border-radius:8px;cursor:pointer;display:flex;align-items:center;justify-content:center}.theme-btn:hover{border-color:var(--a)}
body{background:var(--bg);color:var(--t);font-family:'DM Sans',sans-serif;min-height:100vh;-webkit-font-smoothing:antialiased}
.app{max-width:920px;margin:0 auto;padding:0 16px 60px}
.hdr{display:flex;justify-content:space-between;align-items:center;padding:14px 0;border-bottom:1px solid var(--bd);margin-bottom:20px;flex-wrap:wrap;gap:8px}
.hdr-l{display:flex;align-items:center;gap:10px}
.brand{font-family:'Bebas Neue',cursive;font-size:22px;letter-spacing:2px;color:var(--a)}.brand span{color:var(--t)}
.beta{font-size:10px;background:var(--o);color:var(--bg);padding:2px 7px;border-radius:4px;font-weight:700;font-family:'DM Mono',monospace}
.hdr-r{display:flex;align-items:center;gap:10px}
.pill{font-size:12px;background:var(--s);border:1px solid var(--bd);border-radius:20px;padding:5px 12px;display:flex;align-items:center;gap:7px}
.rb{font-size:9px;background:var(--s2);padding:2px 6px;border-radius:4px;text-transform:uppercase;letter-spacing:1px;font-family:'DM Mono',monospace}.rb.co{background:var(--a);color:var(--bg)}
.lo{background:none;border:1px solid var(--bd);color:var(--t2);font-size:11px;padding:5px 12px;border-radius:8px;cursor:pointer;font-family:'DM Sans',sans-serif}.lo:hover{border-color:var(--r);color:var(--r)}
.mn{padding:0}
.tabs{display:flex;gap:4px;margin-bottom:18px;overflow-x:auto;padding-bottom:4px;-webkit-overflow-scrolling:touch}
.tb{background:var(--s);border:1px solid var(--bd);color:var(--t2);font-size:12px;padding:7px 14px;border-radius:8px;cursor:pointer;white-space:nowrap;font-family:'DM Sans',sans-serif;position:relative}
.tb:hover{border-color:var(--a)}.tb.on{background:var(--a);color:var(--bg);border-color:var(--a);font-weight:600}
.nd{position:absolute;top:-4px;right:-4px;min-width:16px;height:16px;border-radius:8px;font-size:9px;display:flex;align-items:center;justify-content:center;font-weight:700;padding:0 4px}
.nd.or{background:var(--o);color:var(--bg)}.nd.rd{background:var(--r);color:#fff}
.stw{display:grid;grid-template-columns:repeat(auto-fit,minmax(100px,1fr));gap:10px;margin-bottom:18px}
.stc{background:var(--s);border:1px solid var(--bd);border-radius:10px;padding:12px;text-align:center}
.sv{font-size:22px;font-weight:700;font-family:'Bebas Neue',cursive;letter-spacing:1px}
.svl{font-size:10px;color:var(--t2);text-transform:uppercase;letter-spacing:1px;margin-top:2px;font-family:'DM Mono',monospace}
.sa{color:var(--a)}.sg{color:var(--g)}.sy{color:var(--y)}.so{color:var(--o)}.sr2{color:var(--r)}
.af{background:var(--s);border:1px solid var(--bd);border-radius:12px;padding:20px;margin-bottom:18px}
.sct{font-family:'Bebas Neue',cursive;font-size:16px;letter-spacing:2px;color:var(--t2);margin-bottom:10px}
.dv{height:1px;background:var(--bd);margin:16px 0}
.fg{margin-bottom:12px}.fl{font-size:10px;color:var(--t2);text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;font-family:'DM Mono',monospace;display:block}
.fi{width:100%;background:var(--s2);border:1px solid var(--bd);color:var(--t);padding:9px 12px;border-radius:8px;font-size:13px;font-family:'DM Sans',sans-serif}.fi:focus{outline:none;border-color:var(--a)}
.ta{width:100%;background:var(--s2);border:1px solid var(--bd);color:var(--t);padding:9px 12px;border-radius:8px;font-size:13px;font-family:'DM Sans',sans-serif;resize:vertical;min-height:60px}.ta:focus{outline:none;border-color:var(--a)}
.fr{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.fr3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px}
.bt{padding:8px 16px;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;border:none;font-family:'DM Sans',sans-serif;transition:opacity .2s}.bt:hover{opacity:.85}.bt:disabled{opacity:.4;cursor:not-allowed}
.bta{background:var(--a);color:var(--bg)}.btg{background:var(--g);color:#fff}.btr{background:var(--r);color:#fff}.bto{background:var(--o);color:var(--bg)}
.bts{padding:5px 10px;font-size:11px}
.bp{background:var(--s2);color:var(--t);border:1px solid var(--bd)}
.evc{background:var(--s);border:1px solid var(--bd);border-radius:12px;padding:16px;margin-bottom:12px;transition:border-color .2s}
.evh{display:flex;justify-content:space-between;align-items:flex-start;gap:8px;flex-wrap:wrap}
.evn{font-weight:600;font-size:15px}.evm{font-size:11px;color:var(--t2);margin-top:3px;font-family:'DM Mono',monospace;line-height:1.6}
.evb{display:flex;gap:5px;flex-wrap:wrap}
.slb{margin-top:12px;display:grid;grid-template-columns:1fr 1fr;gap:8px}
.sb{flex:1}.sl{display:flex;justify-content:space-between;font-size:10px;color:var(--t2);margin-bottom:3px;font-family:'DM Mono',monospace}
.st{height:6px;background:var(--s2);border-radius:3px;overflow:hidden}
.sf{height:100%;border-radius:3px;transition:width .3s}.sf.p{background:var(--a)}.sf.e{background:var(--p)}.sf.fu{background:var(--g)}
.srow{display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--bd);gap:8px}.srow:last-child{border-bottom:none}
.sn{font-weight:500;font-size:13px}.sme{font-size:10px;color:var(--t2);font-family:'DM Mono',monospace;margin-top:2px}
.bg{font-size:10px;padding:2px 8px;border-radius:4px;font-weight:600;font-family:'DM Mono',monospace;white-space:nowrap}
.bg.si{background:rgba(34,197,94,.15);color:var(--g)}.bg.so2{background:rgba(245,158,11,.15);color:var(--o)}.bg.cf{background:rgba(34,197,94,.15);color:var(--g)}.bg.dn{background:rgba(239,68,68,.15);color:var(--r)}.bg.pc{background:rgba(245,158,11,.15);color:var(--o)}
.pcd{background:var(--s);border:1px solid rgba(255,209,102,.2);border-radius:12px;padding:14px 18px;margin-bottom:8px}
.pcd .pcn{font-weight:600;font-size:14px;margin-bottom:3px}.pcd .pcm{font-size:11px;color:var(--t2);font-family:'DM Mono',monospace;margin-bottom:10px;line-height:1.5}
.pa{display:flex;gap:6px}
.crc{background:var(--s);border:1px solid rgba(245,158,11,.2);border-radius:12px;padding:14px;margin-bottom:8px}
.cn{font-weight:600;font-size:13px}.cm{font-size:11px;color:var(--t2);font-family:'DM Mono',monospace;margin:4px 0 10px;line-height:1.5}
.lt{width:100%;border-collapse:collapse;font-size:12px}
.lt th{font-size:10px;text-transform:uppercase;letter-spacing:.5px;color:var(--t2);font-family:'DM Mono',monospace;font-weight:500;text-align:left;padding:7px 10px;border-bottom:1px solid var(--bd);white-space:nowrap}
.lt td{padding:8px 10px;border-bottom:1px solid var(--bd)}.lt tr:last-child td{border-bottom:none}.lt tr:hover td{background:rgba(255,255,255,.015)}
.nf{position:fixed;bottom:20px;right:20px;padding:10px 18px;border-radius:10px;font-size:13px;font-weight:600;z-index:999;animation:su .3s ease;max-width:320px}
.nf.ok{background:var(--g);color:var(--bg)}.nf.er{background:var(--r);color:#fff}.nf.wr{background:var(--o);color:var(--bg)}
@keyframes su{from{transform:translateY(20px);opacity:0}to{transform:translateY(0);opacity:1}}
.lw{display:flex;justify-content:center;align-items:center;min-height:100vh;padding:20px}
.lc{width:100%;max-width:400px;background:var(--s);border:1px solid var(--bd);border-radius:16px;padding:30px}
.ll{font-family:'Bebas Neue',cursive;font-size:28px;text-align:center;letter-spacing:3px;color:var(--a)}
.ls{text-align:center;font-size:11px;color:var(--t2);margin-top:4px;font-family:'DM Mono',monospace}
.at{display:flex;margin:18px 0;border-radius:8px;overflow:hidden;border:1px solid var(--bd)}
.atb{flex:1;padding:8px;font-size:12px;font-weight:600;background:var(--s2);color:var(--t2);border:none;cursor:pointer;font-family:'DM Sans',sans-serif}.atb.on{background:var(--a);color:var(--bg)}
.pn{background:rgba(245,158,11,.08);border:1px solid rgba(245,158,11,.2);border-radius:10px;padding:16px;text-align:center}.pn h3{font-size:16px;margin-bottom:6px;color:var(--o)}.pn p{font-size:12px;color:var(--t2);line-height:1.5}
.ey{text-align:center;padding:40px 20px;color:var(--t2)}.ei{font-size:36px;margin-bottom:10px}
.sel{width:100%;background:var(--s2);border:1px solid var(--bd);color:var(--t);padding:9px 12px;border-radius:8px;font-size:13px;font-family:'DM Sans',sans-serif}.sel:focus{outline:none;border-color:var(--a)}
.err{color:var(--r);font-size:12px;margin-bottom:10px;text-align:center}
.ld{display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:200px;color:var(--t2);gap:12px}
.spinner{width:30px;height:30px;border:3px solid var(--bd);border-top:3px solid var(--a);border-radius:50%;animation:spin .8s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
.cd{background:var(--s);border:1px solid var(--bd);border-radius:12px;padding:16px;overflow-x:auto}
.ur{background:var(--s);border:1px solid var(--bd);border-radius:12px;padding:20px;margin-bottom:12px}
.urf{border:2px dashed var(--bd);border-radius:10px;padding:24px;text-align:center;cursor:pointer;transition:border-color .2s}.urf:hover{border-color:var(--a)}.urf p{color:var(--t2);font-size:12px;margin-top:6px}
.sts{display:inline-block;font-size:10px;padding:2px 8px;border-radius:4px;font-weight:700;font-family:'DM Mono',monospace;text-transform:uppercase;letter-spacing:.5px}
.loc{font-size:11px;color:var(--t2);margin-top:4px;line-height:1.5}
.loc a{color:var(--a);text-decoration:none}.loc a:hover{text-decoration:underline}
.nts{background:rgba(0,212,255,.05);border:1px solid rgba(0,212,255,.15);border-radius:8px;padding:10px 12px;margin-top:10px;font-size:12px;color:var(--t2);line-height:1.5}
.alr{font-size:12px;padding:10px 0;border-bottom:1px solid var(--bd);display:flex;gap:12px;align-items:flex-start}
.alr:last-child{border-bottom:none}
.alt{font-size:10px;color:var(--t2);font-family:'DM Mono',monospace;white-space:nowrap;min-width:120px}
.ala{font-weight:500}.ald{color:var(--t2);font-size:11px;margin-top:2px}
.dbr{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px}
@media(max-width:600px){.fr,.fr3,.dbr{grid-template-columns:1fr}.hdr{flex-direction:column;align-items:flex-start}}
.modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,.7);display:flex;align-items:center;justify-content:center;z-index:900;padding:20px}
.modal{background:var(--s);border:1px solid var(--bd);border-radius:16px;padding:24px;width:100%;max-width:380px}
.modal .sct{margin-bottom:14px}
.modal .close{position:absolute;top:12px;right:12px;background:none;border:none;color:var(--t2);font-size:18px;cursor:pointer}
.promo-btn{background:none;border:1px solid var(--a);color:var(--a);padding:3px 8px;border-radius:4px;font-size:10px;cursor:pointer;font-family:'DM Mono',monospace}.promo-btn:hover{background:var(--a);color:var(--bg)}
.demote-btn{background:none;border:1px solid var(--r);color:var(--r);padding:3px 8px;border-radius:4px;font-size:10px;cursor:pointer;font-family:'DM Mono',monospace}.demote-btn:hover{background:var(--r);color:#fff}
.bulk-bar{display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap}
.fab-group{position:fixed;bottom:20px;left:16px;display:flex;flex-direction:column;align-items:center;gap:8px;z-index:800}.fab-label{font-size:9px;color:var(--t2);text-transform:uppercase;letter-spacing:1px;font-family:'DM Mono',monospace;text-align:center}.fb-fab{width:44px;height:44px;border-radius:22px;background:var(--a);color:var(--bg);border:none;font-size:20px;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 12px rgba(0,0,0,.3);transition:transform .2s}.fb-fab:hover{transform:scale(1.1)}.help-fab{width:44px;height:44px;border-radius:22px;background:var(--g);color:var(--bg);border:none;font-size:20px;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 12px rgba(0,0,0,.3);transition:transform .2s}.help-fab:hover{transform:scale(1.1)}
.fb-type{display:flex;gap:6px;margin-bottom:14px}.fb-type button{flex:1;padding:8px;border-radius:8px;border:1px solid var(--bd);background:var(--s2);color:var(--t2);font-size:12px;cursor:pointer;font-family:'DM Sans',sans-serif}.fb-type button.act{border-color:var(--a);color:var(--a);background:rgba(0,212,255,.1)}
.fb-item{background:var(--s);border:1px solid var(--bd);border-radius:10px;padding:12px;margin-bottom:8px}
.fb-meta{font-size:10px;color:var(--t2);font-family:'DM Mono',monospace;margin-top:6px;display:flex;justify-content:space-between;align-items:center}
.chat-window{position:fixed;bottom:80px;left:16px;width:320px;max-height:480px;background:var(--s);border:1px solid var(--bd);border-radius:14px;box-shadow:0 8px 32px rgba(0,0,0,.4);z-index:900;display:flex;flex-direction:column;overflow:hidden}
.chat-header{padding:12px 14px;border-bottom:1px solid var(--bd);font-weight:600;font-size:13px;display:flex;justify-content:space-between;align-items:center}
.chat-msgs{flex:1;overflow-y:auto;padding:12px;display:flex;flex-direction:column;gap:8px;max-height:340px}
.chat-msg{max-width:85%;padding:8px 12px;border-radius:12px;font-size:12px;line-height:1.5}
.chat-msg.user{align-self:flex-end;background:var(--a);color:var(--bg);border-bottom-right-radius:4px}
.chat-msg.bot{align-self:flex-start;background:var(--s2);color:var(--t);border-bottom-left-radius:4px}
.chat-input-row{display:flex;gap:6px;padding:10px;border-top:1px solid var(--bd)}
.chat-input-row input{flex:1;background:var(--s2);border:1px solid var(--bd);border-radius:8px;padding:8px 10px;color:var(--t);font-size:12px;font-family:'DM Sans',sans-serif}
.chat-input-row button{background:var(--a);color:var(--bg);border:none;border-radius:8px;padding:8px 12px;cursor:pointer;font-size:13px}
`;

// ─── FEEDBACK MODAL ───────────────────────────────────────────────────────────
const GROQ_KEY = import.meta.env.VITE_GROQ_KEY || "";

const AI_REVIEW_PROMPT = (type, message) => `You are reviewing feedback submitted to the BFRS Special Events Staffing app used by Birmingham Fire & Rescue Service. 

Feedback type: ${type}
Message: "${message}"

Assess this feedback and respond in JSON only (no markdown):
{
  "worthy": true or false,
  "category": "bug" | "feature" | "improvement" | "noise",
  "priority": "high" | "medium" | "low",
  "summary": "one sentence summary",
  "recommendation": "what you recommend doing about this"
}

"worthy" means it deserves attention from the coordinator/developer. Mark noise, spam, or vague complaints as false.`;

const HELP_SYSTEM_PROMPT = `You are a helpful assistant for the BFRS Special Events Staffing app used by Birmingham Fire & Rescue Service in Alabama. Your job is to help coordinators and staff understand how to use the app. Be friendly, clear, and concise.

Here is how the app works:

ROLES:
- Staff (EMT or Paramedic): Can sign up for events, view their status, clock in/out, and submit withdrawal requests.
- Coordinator: Full access — create/manage events, approve or deny staff signups, manage accounts, view attendance, export reports, and see all pending actions on the dashboard.

REGISTRATION & LOGIN:
- New staff register with their name, email, shift (A/B/C/Days), level (EMT or Paramedic), phone number, and Kelly Day number (1-9, ask your supervisor).
- After registering, accounts are PENDING until a coordinator approves them in the Staff tab.
- Once approved, staff can log in and use the app.

EVENTS:
- Coordinators create events with a name, date, start/end time, location, and how many Paramedics and EMTs are needed.
- Events have statuses: Open (accepting signups), Closed, or Cancelled.
- Staff browse open events and tap "Sign Up" to request a spot.

SIGNING UP FOR EVENTS:
- Signing up sends a pending request — it is NOT guaranteed. A coordinator must approve it.
- Staff can sign up for multiple events even on the same day. The app will warn about shift conflicts but allows it — the coordinator decides who gets assigned.
- If you are on regular duty that day, the app shows a warning so you are aware.
- Kelly Day warnings also appear if the event falls on your Kelly day.

COORDINATOR APPROVAL WORKFLOW:
- Coordinators open an event and tap "Manage" to see all pending signups.
- The app RECOMMENDS who to approve using a star (⭐) system based on: credential match, not on regular duty, fewest events that month, and signup time.
- Stars are suggestions only — coordinators make the final call.
- IMPORTANT: If a staff member is already confirmed for an overlapping event on the same day, the app will BLOCK approval and show an error. This prevents double-booking.

WITHDRAWAL REQUESTS:
- If a confirmed staff member needs to cancel, they tap "Cancel" on the event. This sends a withdrawal request — it does NOT immediately remove them.
- The coordinator sees the request in the Cancel Reqs tab and must approve or deny it.
- If approved, the slot opens back up for other staff.
- Staff see a "⏳ Withdrawal Pending" badge while waiting.

ATTENDANCE (CLOCK IN/OUT):
- On event day, confirmed staff tap "Clock In" when they arrive and "Clock Out" when they leave.
- Hours are tracked automatically and shown in the leaderboard on the dashboard.

DASHBOARD (Coordinators only):
- Shows pending accounts, pending signups, and withdrawal requests as clickable cards.
- Tap any pending card to jump directly to that section.
- The Pending Actions panel lists every item needing attention with a Review button.

KELLY DAYS:
- Every 9 shifts (27 days), staff get a Kelly day off.
- Each staff member has a Kelly number (1-9) set during registration.
- If an event falls on your Kelly day, the app shows a warning.
- Exception: If a Kelly day falls on a payday Friday, that Kelly day is skipped.

SHIFT ROTATION:
- Birmingham Fire & Rescue works 24 hours on, 48 hours off.
- Shifts rotate A → B → C.
- The app detects which shift is working on any event date and warns staff accordingly.

FEEDBACK:
- Use the 💬 Feedback button (bottom left) to report bugs, suggest ideas, or leave comments.
- All feedback is reviewed and sent to Chief Hendon.

If someone asks about ideas or improvements, let them know their suggestion will be forwarded to Chief Clay Hendon who oversees special events, and that all ideas are appreciated and taken seriously.

If you don't know something specific about their situation, encourage them to reach out to their coordinator directly.`;

function FeedbackModal({ onClose, notify, userId, userName }) {
  const [type, setType] = useState("idea");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!msg.trim()) { notify("Please enter a message.", "error"); return; }
    setBusy(true);
    const { error } = await supabase.from("feedback").insert({ user_id: userId, type, message: msg.trim() });
    if (error) { setBusy(false); notify(error.message, "error"); return; }

    // AI review in background
    try {
      const res = await fetch("/.netlify/functions/chatbot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ system: "You are an AI that reviews app feedback. Always respond with valid JSON only.", messages: [{ role: "user", content: AI_REVIEW_PROMPT(type, msg.trim()) }] })
      });
      const aiData = await res.json();
      const rawText = aiData.choices?.[0]?.message?.content || "{}";
      const review = JSON.parse(rawText.replace(/```json|```/g, "").trim());

      // Email coordinators with AI assessment
      const emailHtml = `
        <h3>New ${type} Feedback from ${userName || "a staff member"}</h3>
        <p><b>Message:</b> ${msg.trim()}</p>
        <hr/>
        <h4>🤖 AI Assessment</h4>
        <p><b>Category:</b> ${review.category} &nbsp;|&nbsp; <b>Priority:</b> ${review.priority}</p>
        <p><b>Summary:</b> ${review.summary}</p>
        <p><b>Recommendation:</b> ${review.recommendation}</p>
        ${review.worthy ? '<p style="color:green"><b>✅ Marked as worthy of review</b></p>' : '<p style="color:gray">ℹ️ AI flagged as low priority / noise</p>'}
      `;
      if (review.worthy) {
        await fetch("/.netlify/functions/send-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ to: COORDINATOR_EMAILS, subject: `[${review.priority.toUpperCase()}] ${type} Feedback — ${review.summary}`, html: emailHtml })
        });
      }
    } catch(e) { /* silent — review is optional */ }

    setBusy(false);
    notify("Feedback submitted — thank you! Chief Hendon has been notified.");
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="sct">Send Feedback</div>
        <div style={{ fontSize: 11, color: "var(--t2)", marginBottom: 12 }}>Report a bug, share an idea, or leave a comment. All feedback goes directly to Chief Hendon.</div>
        <div className="fb-type">
          <button className={type === "bug" ? "act" : ""} onClick={() => setType("bug")}>🐛 Bug</button>
          <button className={type === "idea" ? "act" : ""} onClick={() => setType("idea")}>💡 Idea</button>
          <button className={type === "comment" ? "act" : ""} onClick={() => setType("comment")}>💬 Comment</button>
        </div>
        <div className="fg"><label className="fl">{type === "bug" ? "Describe the bug" : type === "idea" ? "What's your idea?" : "Your comment"}</label>
          <textarea className="ta" rows={4} value={msg} onChange={e => setMsg(e.target.value)} placeholder={type === "bug" ? "What happened? What did you expect?" : type === "idea" ? "How could we make this app better?" : "Any thoughts or feedback..."} />
        </div>
        <div className="pa" style={{ marginTop: 8 }}>
          <button className="bt bta" onClick={submit} disabled={busy}>{busy ? "Sending..." : "Submit"}</button>
          <button className="bt bp" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

function HelpChat({ onClose }) {
  const [messages, setMessages] = useState([{ role: "bot", text: "Hi! I'm the BFRS App Assistant. Ask me anything about how the app works — signing up for events, approvals, Kelly days, attendance, or anything else." }]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const send = async () => {
    const q = input.trim();
    if (!q || busy) return;
    setInput("");
    setMessages(m => [...m, { role: "user", text: q }]);
    setBusy(true);
    try {
      const history = messages.filter(m => m.role !== "bot" || messages.indexOf(m) > 0).map(m => ({ role: m.role === "user" ? "user" : "assistant", content: m.text }));
      const res = await fetch("/.netlify/functions/chatbot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ system: HELP_SYSTEM_PROMPT, messages: [...history, { role: "user", content: q }] })
      });
      const data = await res.json();
      const answer = data.choices?.[0]?.message?.content || "Sorry, I couldn't get a response. Try again.";
      setMessages(m => [...m, { role: "bot", text: answer }]);
    } catch(e) {
      setMessages(m => [...m, { role: "bot", text: "Connection error. Please try again." }]);
    }
    setBusy(false);
  };

  return (
    <div className="chat-window">
      <div className="chat-header">
        <span>🤖 App Help Assistant</span>
        <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--t2)", fontSize: 16, cursor: "pointer" }}>✕</button>
      </div>
      <div className="chat-msgs">
        {messages.map((m, i) => <div key={i} className={`chat-msg ${m.role}`}>{m.text}</div>)}
        {busy && <div className="chat-msg bot" style={{ opacity: 0.6 }}>Thinking...</div>}
        <div ref={bottomRef} />
      </div>
      <div className="chat-input-row">
        <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && send()} placeholder="Ask a question..." disabled={busy} />
        <button onClick={send} disabled={busy}>➤</button>
      </div>
    </div>
  );
}

// ─── CHANGE PASSWORD ──────────────────────────────────────────────────────────
function ChangePassword({ onClose, notify }) {
  const [curr, setCurr] = useState("");
  const [newP, setNewP] = useState("");
  const [conf, setConf] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setErr(""); setBusy(true);
    if (!newP || !conf) { setErr("All fields required."); setBusy(false); return; }
    if (newP !== conf) { setErr("Passwords do not match."); setBusy(false); return; }
    if (newP.length < 6) { setErr("Min 6 characters."); setBusy(false); return; }
    const { error } = await supabase.auth.updateUser({ password: newP });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    notify("Password changed successfully.");
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="sct">Change Password</div>
        {err && <div className="err">{err}</div>}
        <div className="fg"><label className="fl">New Password</label><input className="fi" type="password" value={newP} onChange={e => setNewP(e.target.value)} /></div>
        <div className="fg"><label className="fl">Confirm New Password</label><input className="fi" type="password" value={conf} onChange={e => setConf(e.target.value)} onKeyDown={e => e.key === "Enter" && submit()} /></div>
        <div className="pa" style={{ marginTop: 8 }}>
          <button className="bt bta" onClick={submit} disabled={busy}>{busy ? "Saving..." : "Change Password"}</button>
          <button className="bt bp" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function App() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notif, setNotif] = useState(null);
  const [showPwModal, setShowPwModal] = useState(false);
  const [showFbModal, setShowFbModal] = useState(false);
  const [showHelpChat, setShowHelpChat] = useState(false);
  const [viewAsStaff, setViewAsStaff] = useState(false);
  const [theme, setTheme] = useState(() => {
    try { return localStorage.getItem("bfrs-theme") || "dark"; } catch { return "dark"; }
  });
  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    try { localStorage.setItem("bfrs-theme", next); } catch {}
  };
  useEffect(() => { document.documentElement.setAttribute("data-theme", theme); }, [theme]);
  const notify = useCallback((msg, t = "ok") => { setNotif({ msg, t }); setTimeout(() => setNotif(null), 3200); }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      if (s) loadProfile(s.user.id); else setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_ev, s) => {
      setSession(s);
      if (s) loadProfile(s.user.id); else { setProfile(null); setLoading(false); }
    });
    return () => subscription.unsubscribe();
  }, []);

  const loadProfile = async (uid) => {
    const { data } = await supabase.from("profiles").select("*").eq("id", uid).single();
    setProfile(data); setLoading(false);
  };

  const handleLogout = async () => { await supabase.auth.signOut(); setSession(null); setProfile(null); };

  if (loading) return (<><style>{css}</style><div className="lw"><div className="ld"><div className="spinner" /><span style={{ fontSize: 12 }}>Loading...</span></div></div></>);

  return (
    <><style>{css}</style>
      <div className="app">
        {!session || !profile ? (
          <Auth onLogin={(s, p) => { setSession(s); setProfile(p); }} notify={notify} theme={theme} toggleTheme={toggleTheme} />
        ) : !profile.approved ? (
          <PendingScreen onLogout={handleLogout} theme={theme} toggleTheme={toggleTheme} />
        ) : (
          <>
            <div className="hdr">
              <div className="hdr-l"><img src={BADGE_SRC} alt="BFRS" style={{ height: 36, borderRadius: 4 }} /><div className="brand">BFRS <span>Events</span></div><span className="beta">BETA {APP_VERSION}</span></div>
              <div className="hdr-r">
                <div className="pill">{profile.name}<span className={`rb${profile.role === "coordinator" ? " co" : ""}`}>{profile.role}</span></div>
                <button className="theme-btn" onClick={toggleTheme} title={theme === "dark" ? "Light mode" : "Dark mode"}>{theme === "dark" ? "☀️" : "🌙"}</button>
                <button className="lo" onClick={() => setShowPwModal(true)} style={{ borderColor: "var(--a)", color: "var(--a)" }}>🔑</button>
                {profile.role === "coordinator" && <button className="lo" onClick={() => setViewAsStaff(v => !v)} style={{ borderColor: viewAsStaff ? "var(--g)" : "var(--bd)", color: viewAsStaff ? "var(--g)" : "var(--t2)", fontSize: 10 }}>{viewAsStaff ? "👁 Staff View" : "👁 Coord"}</button>}
                <button className="lo" onClick={handleLogout}>Logout</button>
              </div>
            </div>
            {showPwModal && <ChangePassword onClose={() => setShowPwModal(false)} notify={notify} />}
            {showFbModal && <FeedbackModal onClose={() => setShowFbModal(false)} notify={notify} userId={profile.id} userName={profile.name} />}
            {showHelpChat && <HelpChat onClose={() => setShowHelpChat(false)} />}
            <div className="fab-group">
              <div className="fab-label">Help</div>
              <button className="help-fab" onClick={() => { setShowHelpChat(h => !h); setShowFbModal(false); }} title="App Help">🤖</button>
              <button className="fb-fab" onClick={() => { setShowFbModal(true); setShowHelpChat(false); }} title="Send Feedback">💬</button>
              <div className="fab-label">Feedback</div>
            </div>
            <main className="mn">
              {profile.role === "coordinator" && !viewAsStaff
                ? <CoordView profile={profile} notify={notify} />
                : <StaffView profile={profile} notify={notify} />}
            </main>
          </>
        )}
        {notif && <div className={`nf ${notif.t === "error" ? "er" : notif.t === "warn" ? "wr" : "ok"}`}>{notif.msg}</div>}
      </div>
    </>
  );
}

// ─── PENDING ──────────────────────────────────────────────────────────────────
function PendingScreen({ onLogout, theme, toggleTheme }) {
  return (
    <div className="lw"><div className="lc">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div className="ll" style={{ display: "flex", alignItems: "center", gap: 8 }}><img src={BADGE_SRC} alt="BFRS" style={{ height: 32, borderRadius: 4 }} />BFRS Events <span className="beta" style={{ fontSize: 10 }}>BETA {APP_VERSION}</span></div>
        <button className="theme-btn" onClick={toggleTheme}>{theme === "dark" ? "☀️" : "🌙"}</button>
      </div>
      <div style={{ marginTop: 20 }}>
        <div className="pn"><h3>⏳ Pending Approval</h3><p>Your registration is under review by a coordinator. You'll be able to log in once approved.</p></div>
        <button className="bt bp" style={{ marginTop: 14, width: "100%" }} onClick={onLogout}>Back to Login</button>
      </div>
    </div></div>
  );
}

// ─── AUTH ──────────────────────────────────────────────────────────────────────
function Auth({ onLogin, notify, theme, toggleTheme }) {
  const [v, setV] = useState("login");
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [reg, setReg] = useState({ name: "", email: "", password: "", confirm: "", level: "EMT", shift: "A", phone: "", kelly_number: "" });
  const [rErr, setRErr] = useState("");

  const login = async () => {
    setErr(""); setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: pass });
    setBusy(false);
    if (error) { setErr(error.message); return; }
  };

  const register = async () => {
    setRErr(""); setBusy(true);
    const { name, email, password, confirm, level, shift, phone, kelly_number } = reg;
    if (!name || !email || !password || !phone) { setRErr("All fields required."); setBusy(false); return; }
    if (password !== confirm) { setRErr("Passwords do not match."); setBusy(false); return; }
    if (password.length < 6) { setRErr("Min 6 characters."); setBusy(false); return; }
    const { data: signUpData, error } = await supabase.auth.signUp({
      email: email.trim(), password,
      options: { data: { name, level, shift, phone, kelly_number: kelly_number ? parseInt(kelly_number) : null, role: "staff" } }
    });
    if (error) { setBusy(false); setRErr(error.message); return; }
    // Directly upsert profile row so all fields (including kelly_number) are saved immediately
    if (signUpData?.user?.id) {
      await supabase.from("profiles").upsert({
        id: signUpData.user.id,
        name, email: email.trim(), level, shift, phone,
        kelly_number: kelly_number ? parseInt(kelly_number) : null,
        role: "staff", approved: false,
      }, { onConflict: "id" });
    }
    setBusy(false);
    // Fire notification to coordinators
    sendNotification("new_registration", { name, email: email.trim(), level, shift, phone });
    notify("Registration submitted — awaiting coordinator approval.");
  };

  return (
    <div className="lw"><div className="lc">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div className="ll" style={{ display: "flex", alignItems: "center", gap: 8 }}><img src={BADGE_SRC} alt="BFRS" style={{ height: 32, borderRadius: 4 }} />BFRS Events <span className="beta" style={{ fontSize: 10 }}>BETA {APP_VERSION}</span></div>
        <button className="theme-btn" onClick={toggleTheme}>{theme === "dark" ? "☀️" : "🌙"}</button>
      </div>
      <div className="ls">Special Events Staffing — Birmingham Fire &amp; Rescue</div>
      <div className="at">
        <button className={`atb${v === "login" ? " on" : ""}`} onClick={() => { setV("login"); setErr(""); }}>Sign In</button>
        <button className={`atb${v === "register" ? " on" : ""}`} onClick={() => { setV("register"); setRErr(""); }}>Register</button>
      </div>
      {v === "login" ? (<>
        {err && <div className="err">{err}</div>}
        <div className="fg"><label className="fl">Email</label><input className="fi" type="email" value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key === "Enter" && login()} /></div>
        <div className="fg"><label className="fl">Password</label><input className="fi" type="password" value={pass} onChange={e => setPass(e.target.value)} onKeyDown={e => e.key === "Enter" && login()} /></div>
        <button className="bt bta" style={{ width: "100%", marginTop: 6 }} onClick={login} disabled={busy}>{busy ? "Signing in..." : "Sign In"}</button>
      </>) : (<>
        {rErr && <div className="err">{rErr}</div>}
        <div className="fg"><label className="fl">Full Name</label><input className="fi" value={reg.name} onChange={e => setReg(p => ({ ...p, name: e.target.value }))} /></div>
        <div className="fg"><label className="fl">Email</label><input className="fi" type="email" value={reg.email} onChange={e => setReg(p => ({ ...p, email: e.target.value }))} /></div>
        <div className="fr">
          <div className="fg"><label className="fl">Password</label><input className="fi" type="password" value={reg.password} onChange={e => setReg(p => ({ ...p, password: e.target.value }))} /></div>
          <div className="fg"><label className="fl">Confirm</label><input className="fi" type="password" value={reg.confirm} onChange={e => setReg(p => ({ ...p, confirm: e.target.value }))} /></div>
        </div>
        <div className="fr">
          <div className="fg"><label className="fl">Level</label><select className="sel" value={reg.level} onChange={e => setReg(p => ({ ...p, level: e.target.value }))}><option>EMT</option><option>Paramedic</option></select></div>
          <div className="fg"><label className="fl">Shift</label><select className="sel" value={reg.shift} onChange={e => setReg(p => ({ ...p, shift: e.target.value }))}><option>A</option><option>B</option><option>C</option><option>Days</option></select></div>
        </div>
        <div className="fg"><label className="fl">Phone</label><input className="fi" type="tel" value={reg.phone} onChange={e => setReg(p => ({ ...p, phone: e.target.value }))} /></div>
        <div className="fg"><label className="fl">Kelly Day # <span style={{fontSize:10,color:"var(--t2)"}}>(1–9, ask your supervisor)</span></label><select className="sel" value={reg.kelly_number} onChange={e => setReg(p => ({ ...p, kelly_number: e.target.value }))}><option value="">— Select —</option>{[1,2,3,4,5,6,7,8,9].map(n => <option key={n} value={n}>{n}</option>)}</select></div>
        <button className="bt bta" style={{ width: "100%", marginTop: 6 }} onClick={register} disabled={busy}>{busy ? "Registering..." : "Register"}</button>
      </>)}
    </div></div>
  );
}

// ─── DATA HOOK ────────────────────────────────────────────────────────────────
function useData() {
  const [profiles, setProfiles] = useState([]);
  const [events, setEvents] = useState([]);
  const [signups, setSignups] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [cancelReqs, setCancelReqs] = useState([]);
  const [activityLog, setActivityLog] = useState([]);
  const [feedback, setFeedback] = useState([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const [pR, eR, sR, aR, cR, lR, fR] = await Promise.all([
      supabase.from("profiles").select("*").order("name"),
      supabase.from("events").select("*").order("date"),
      supabase.from("signups").select("*"),
      supabase.from("attendance").select("*"),
      supabase.from("cancel_requests").select("*").order("requested_at", { ascending: false }),
      supabase.from("activity_log").select("*").order("created_at", { ascending: false }).limit(200),
      supabase.from("feedback").select("*").order("created_at", { ascending: false }),
    ]);
    if (pR.data) setProfiles(pR.data);
    if (eR.data) setEvents(eR.data);
    if (sR.data) setSignups(sR.data);
    if (aR.data) setAttendance(aR.data);
    if (cR.data) setCancelReqs(cR.data);
    if (lR.data) setActivityLog(lR.data);
    if (fR.data) setFeedback(fR.data);
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => { refresh(); }, 30000);
    return () => clearInterval(interval);
  }, [refresh]);

  // Refresh immediately when app comes back to foreground
  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === "visible") refresh(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [refresh]);

  return { profiles, events, signups, attendance, cancelReqs, activityLog, feedback, loading, refresh };
}

// ─── EVENT STATUS BADGE ───────────────────────────────────────────────────────
function StatusBadge({ status }) {
  return <span className="sts" style={{ background: `${STATUS_COLORS[status]}22`, color: STATUS_COLORS[status] }}>{STATUS_LABELS[status]}</span>;
}
function SignupBadge({status}){const s=SIGNUP_STATUS[status]||SIGNUP_STATUS.pending;return <span className={`bg ${s.cls}`}>{s.label}</span>;}

// ─── SMART SIGNUP SCORER ─────────────────────────────────────────────────────
// Scores each pending signup to recommend best approvals for an event.
// Criteria: credential match, not on duty, fewer events this month, sign-up order.
const scoreSignup = (signup, staff, event, allSignups, allEvents) => {
  let score = 0;
  const eventDate = event.date ? new Date(event.date) : null;
  const month = eventDate ? eventDate.getMonth() : -1;
  const year = eventDate ? eventDate.getFullYear() : -1;

  // +30 credential match
  const needsParamedic = (event.needed_paramedics || 0) > 0;
  const needsEMT = (event.needed_emts || 0) > 0;
  if (staff.level === "Paramedic" && needsParamedic) score += 30;
  else if (staff.level === "EMT" && needsEMT) score += 30;
  else if (staff.level === "Paramedic" && !needsParamedic && needsEMT) score += 10; // paramedic can fill EMT slot
  
  // +25 not on regular duty that day
  const onShift = getShiftForDate(event.date) === staff.shift;
  if (!onShift) score += 25;

  // +20 no time conflicts with existing confirmed events
  const conflicts = findConflicts(event.id, staff.id, allEvents, allSignups);
  if (conflicts.length === 0) score += 20;

  // +15 fewer confirmed events this month (inversely proportional)
  const monthlyConfirmed = allSignups.filter(s =>
    s.staff_id === staff.id && s.status === "confirmed" &&
    (() => { const d = allEvents.find(e => e.id === s.event_id); if (!d?.date) return false; const dd = new Date(d.date); return dd.getMonth() === month && dd.getFullYear() === year; })()
  ).length;
  score += Math.max(0, 15 - monthlyConfirmed * 3);

  // +5 earlier signup (first come noted)
  score += signup.signed_up_at ? 5 : 0;

  return score;
};

// Returns set of signup IDs that are recommended for this event
const getRecommended = (pendingSignups, profiles, event, allSignups, allEvents) => {
  if (!pendingSignups.length) return new Set();
  const scored = pendingSignups.map(s => {
    const staff = profiles.find(p => p.id === s.staff_id);
    if (!staff) return { id: s.id, score: 0, level: "EMT" };
    return { id: s.id, score: scoreSignup(s, staff, event, allSignups, allEvents), level: staff.level };
  }).sort((a, b) => b.score - a.score);

  const recommended = new Set();
  let parasNeeded = event.needed_paramedics || 0;
  let emtsNeeded = event.needed_emts || 0;

  // Fill paramedic slots first from top-scored paramedics
  for (const s of scored) {
    if (parasNeeded > 0 && s.level === "Paramedic") { recommended.add(s.id); parasNeeded--; }
  }
  // Fill EMT slots from top-scored EMTs (paramedics can backfill)
  for (const s of scored) {
    if (emtsNeeded > 0 && (s.level === "EMT" || (s.level === "Paramedic" && !recommended.has(s.id)))) {
      recommended.add(s.id); emtsNeeded--;
    }
  }
  return recommended;
};

// ─── COORDINATOR VIEW ─────────────────────────────────────────────────────────
function CoordView({ profile, notify }) {
  const { profiles, events, signups, attendance, cancelReqs, activityLog, feedback, loading, refresh } = useData();
  const [tab, setTab] = useState("events");
  const [addEv, setAddEv] = useState({ name: "", date: "", time_start: "", time_end: "", location: "", venue: "", notes: "", needed_paramedics: 2, needed_emts: 2 });
  const [selEv, setSelEv] = useState(null);
  const [editEv, setEditEv] = useState(null);
  const fileRef = useRef(null);
  const [upRes, setUpRes] = useState(null);
  const [previewEvs, setPreviewEvs] = useState(null);

  const pendingAccounts = profiles.filter(p => !p.approved && p.role === "staff");
  const pendingCR = cancelReqs.filter(c => c.status === "pending");

  // ── Account actions ──
  const approveAccount = async (id) => {
    const acc = profiles.find(p => p.id === id);
    const { error } = await supabase.from("profiles").update({ approved: true }).eq("id", id);
    if (error) { notify(error.message, "error"); return; }
    await logActivity("approved_account", "profile", id, { name: acc?.name });
    sendNotification("account_approved", { name: acc?.name, email: acc?.email });
    notify("Account approved."); refresh();
  };
  const approveAll = async () => {
    if (pendingAccounts.length === 0) return;
    const ids = pendingAccounts.map(a => a.id);
    const { error } = await supabase.from("profiles").update({ approved: true }).in("id", ids);
    if (error) { notify(error.message, "error"); return; }
    for (const acc of pendingAccounts) {
      await logActivity("approved_account", "profile", acc.id, { name: acc.name });
      sendNotification("account_approved", { name: acc.name, email: acc.email });
    }
    notify(`${pendingAccounts.length} accounts approved.`); refresh();
  };
  const denyAccount = async (id) => {
    const acc = profiles.find(p => p.id === id);
    await logActivity("denied_account", "profile", id, { name: acc?.name });
    await supabase.from("profiles").delete().eq("id", id);
    notify("Account denied.", "error"); refresh();
  };
  const promoteToCoordinator = async (id) => {
    const acc = profiles.find(p => p.id === id);
    const { error } = await supabase.from("profiles").update({ role: "coordinator" }).eq("id", id);
    if (error) { notify(error.message, "error"); return; }
    await logActivity("promoted_to_coordinator", "profile", id, { name: acc?.name });
    notify(`${acc?.name} promoted to coordinator.`); refresh();
  };
  const demoteToStaff = async (id) => {
    if (id === profile.id) { notify("Can't demote yourself.", "error"); return; }
    const acc = profiles.find(p => p.id === id);
    const { error } = await supabase.from("profiles").update({ role: "staff" }).eq("id", id);
    if (error) { notify(error.message, "error"); return; }
    await logActivity("demoted_to_staff", "profile", id, { name: acc?.name });
    notify(`${acc?.name} demoted to staff.`); refresh();
  };

  // ── Event actions ──
  const createEvent = async () => {
    if (!addEv.name || !addEv.date || !addEv.time_start || !addEv.time_end) { notify("Fill required event fields.", "error"); return; }
    const { data, error } = await supabase.from("events").insert({
      ...addEv, status: "open",
      needed_paramedics: parseInt(addEv.needed_paramedics) || 0,
      needed_emts: parseInt(addEv.needed_emts) || 0,
      created_by: profile.id
    }).select().single();
    if (error) { notify(error.message, "error"); return; }
    await logActivity("created_event", "event", data.id, { name: addEv.name });
    setAddEv({ name: "", date: "", time_start: "", time_end: "", location: "", venue: "", notes: "", needed_paramedics: 2, needed_emts: 2 });
    notify("Event created!"); refresh();
  };

  const deleteEvent = async (id) => {
    const ev = events.find(e => e.id === id);
    await logActivity("deleted_event", "event", id, { name: ev?.name });
    await supabase.from("events").delete().eq("id", id);
    notify("Event deleted."); refresh();
  };

  const updateEventStatus = async (id, status) => {
    const ev = events.find(e => e.id === id);
    await supabase.from("events").update({ status }).eq("id", id);
    await logActivity("changed_event_status", "event", id, { name: ev?.name, status });
    notify(`Event marked as ${status}.`); refresh();
  };

  const saveEventEdit = async () => {
    if (!editEv) return;
    const { id, ...fields } = editEv;
    fields.needed_paramedics = parseInt(fields.needed_paramedics) || 0;
    fields.needed_emts = parseInt(fields.needed_emts) || 0;
    const { error } = await supabase.from("events").update(fields).eq("id", id);
    if (error) { notify(error.message, "error"); return; }
    await logActivity("edited_event", "event", id, { name: fields.name });
    setEditEv(null); notify("Event updated."); refresh();
  };

  // ── Attendance ──
  const coordSignIn = async (staffId, eventId) => {
    const exists = attendance.find(a => a.staff_id === staffId && a.event_id === eventId);
    if (exists) { notify("Already clocked in.", "error"); return; }
    await supabase.from("attendance").insert({ staff_id: staffId, event_id: eventId, sign_in_time: nowISO() });
    const ac = profiles.find(p => p.id === staffId);
    await logActivity("clocked_in_staff", "attendance", eventId, { staffName: ac?.name });
    notify("Clocked in!"); refresh();
  };
  const coordSignOut = async (staffId, eventId) => {
    const rec = attendance.find(a => a.staff_id === staffId && a.event_id === eventId && !a.sign_out_time);
    if (!rec) return;
    await supabase.from("attendance").update({ sign_out_time: nowISO() }).eq("id", rec.id);
    const ac = profiles.find(p => p.id === staffId);
    await logActivity("clocked_out_staff", "attendance", eventId, { staffName: ac?.name });
    notify("Clocked out!"); refresh();
  };
  const coordRemoveSignup = async (staffId, eventId) => {
    await supabase.from("signups").delete().match({ staff_id: staffId, event_id: eventId });
    const ac = profiles.find(p => p.id === staffId);
    await logActivity("removed_signup", "signup", eventId, { staffName: ac?.name });
    notify("Signup removed."); refresh();
  };
  const approveSignup = async (signupId) => {
    const su = signups.find(s => s.id === signupId);
    const ac = profiles.find(p => p.id === su?.staff_id);
    const ev = events.find(e => e.id === su?.event_id);
    // Hard block — cannot approve if staff already confirmed for overlapping event
    const conflicts = findConflicts(su?.event_id, su?.staff_id, events, signups);
    if (conflicts.length > 0) {
      const c = conflicts[0];
      const msg = `Cannot approve — ${ac?.name} is already confirmed for "${c.name}" (${fmtDate(c.date)} ${fmtTime(c.time_start)}–${fmtTime(c.time_end)}) which overlaps with this event.`;
      notify(msg, "error");
      sendNotification("overlap_alert", {
        staffName: ac?.name,
        eventDate: fmtDate(ev?.date),
        newEvent: ev?.name,
        existingEvent: c.name,
        existingTime: `${fmtTime(c.time_start)}–${fmtTime(c.time_end)}`,
      });
      return;
    }
    await supabase.from("signups").update({ status: "confirmed" }).eq("id", signupId);
    await logActivity("approved_signup", "signup", signupId, { staffName: ac?.name, eventName: ev?.name });
    notify(`${ac?.name} approved for ${ev?.name}.`); refresh();
  };
  const denySignup = async (signupId) => {
    const su = signups.find(s => s.id === signupId);
    await supabase.from("signups").update({ status: "denied" }).eq("id", signupId);
    const ac = profiles.find(p => p.id === su?.staff_id);
    const ev = events.find(e => e.id === su?.event_id);
    await logActivity("denied_signup", "signup", signupId, { staffName: ac?.name, eventName: ev?.name });
    notify(`${ac?.name} denied for ${ev?.name}.`); refresh();
  };
  const pendingSignups = signups.filter(s => s.status === "pending");

  // ── Cancel requests ──
  const approveCR = async (crId) => {
    const cr = cancelReqs.find(c => c.id === crId);
    if (!cr) return;
    await supabase.from("cancel_requests").update({ status: "approved" }).eq("id", crId);
    await supabase.from("signups").delete().match({ staff_id: cr.staff_id, event_id: cr.event_id });
    const ac = profiles.find(p => p.id === cr.staff_id);
    const ev = events.find(e => e.id === cr.event_id);
    await logActivity("approved_cancel", "cancel_request", crId, { staffName: ac?.name, eventName: ev?.name });
    sendNotification("cancel_decision", { staffEmail: ac?.email, staffName: ac?.name, eventName: ev?.name, decision: "approved" });
    notify("Cancel approved."); refresh();
  };
  const denyCR = async (crId) => {
    const cr = cancelReqs.find(c => c.id === crId);
    await supabase.from("cancel_requests").update({ status: "denied" }).eq("id", crId);
    const ac = profiles.find(p => p.id === cr?.staff_id);
    const ev = events.find(e => e.id === cr?.event_id);
    await logActivity("denied_cancel", "cancel_request", crId, { staffName: ac?.name, eventName: ev?.name });
    sendNotification("cancel_decision", { staffEmail: ac?.email, staffName: ac?.name, eventName: ev?.name, decision: "denied" });
    notify("Cancel denied."); refresh();
  };

  // ── Excel import with preview ──
  const handleUpload = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    try {
      const XLSX = await loadSheetJS();
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data);
      const { events: newEvs, errors } = parseExcelToEvents(wb);
      setPreviewEvs({ events: newEvs, errors, fileName: file.name });
      if (newEvs.length === 0) notify("No events found in file.", "warn");
      else notify(`Found ${newEvs.length} events — review below.`);
    } catch (err) { notify("Import failed: " + err.message, "error"); }
    e.target.value = "";
  };
  const confirmImport = async () => {
    if (!previewEvs || previewEvs.events.length === 0) return;
    const toInsert = previewEvs.events.map(ev => ({ ...ev, created_by: profile.id }));
    const { error } = await supabase.from("events").insert(toInsert);
    if (error) { notify("Import error: " + error.message, "error"); return; }
    await logActivity("imported_events", "event", "bulk", { count: previewEvs.events.length });
    setUpRes({ count: previewEvs.events.length, errors: previewEvs.errors });
    setPreviewEvs(null);
    notify(`${toInsert.length} events imported!`); refresh();
  };

  // ── Dashboard data ──
  const staffHours = useMemo(() => {
    const map = {};
    attendance.forEach(a => {
      if (!a.sign_out_time) return;
      const hrs = parseFloat(calcHours(a.sign_in_time, a.sign_out_time)) || 0;
      if (!map[a.staff_id]) map[a.staff_id] = { total: 0, events: 0 };
      map[a.staff_id].total += hrs;
      map[a.staff_id].events += 1;
    });
    return Object.entries(map).map(([id, d]) => {
      const p = profiles.find(x => x.id === id);
      return { id, name: p?.name || "?", level: p?.level || "?", shift: p?.shift || "?", ...d };
    }).sort((a, b) => b.total - a.total);
  }, [attendance, profiles]);

  // ── CSV Export ──
  const exportAttendance = () => {
    const headers = ["Staff Name", "Level", "Shift", "Event", "Date", "Sign In", "Sign Out", "Hours"];
    const rows = attendance.map(a => {
      const ac = profiles.find(x => x.id === a.staff_id);
      const ev = events.find(x => x.id === a.event_id);
      return [ac?.name, ac?.level, ac?.shift, ev?.name, ev?.date, a.sign_in_time, a.sign_out_time || "", a.sign_out_time ? calcHours(a.sign_in_time, a.sign_out_time) : ""];
    });
    downloadCSV(`bfrs-attendance-${new Date().toISOString().split("T")[0]}.csv`, headers, rows);
    notify("Attendance exported.");
  };
  const exportStaffHours = () => {
    const headers = ["Staff Name", "Level", "Shift", "Total Hours", "Events Worked"];
    const rows = staffHours.map(s => [s.name, s.level, s.shift, s.total.toFixed(1), s.events]);
    downloadCSV(`bfrs-staff-hours-${new Date().toISOString().split("T")[0]}.csv`, headers, rows);
    notify("Staff hours exported.");
  };

  if (loading) return <div className="ld"><div className="spinner" /><span style={{ fontSize: 12 }}>Loading data...</span></div>;

  return (<>
    <div className="tabs">
      <button className={`tb${tab === "dash" ? " on" : ""}`} onClick={() => setTab("dash")}>Dashboard</button>
      <button className={`tb${tab === "events" ? " on" : ""}`} onClick={() => setTab("events")}>Events{pendingSignups.length>0&&<span className="nd or">{pendingSignups.length}</span>}</button>
      <button className={`tb${tab === "staff" ? " on" : ""}`} onClick={() => setTab("staff")}>Staff{pendingAccounts.length > 0 && <span className="nd or">{pendingAccounts.length}</span>}</button>
      <button className={`tb${tab === "att" ? " on" : ""}`} onClick={() => setTab("att")}>Attendance</button>
      <button className={`tb${tab === "cr" ? " on" : ""}`} onClick={() => setTab("cr")}>Cancel Reqs{pendingCR.length > 0 && <span className="nd or">{pendingCR.length}</span>}</button>
      <button className={`tb${tab === "log" ? " on" : ""}`} onClick={() => setTab("log")}>Activity Log</button>
      <button className={`tb${tab === "import" ? " on" : ""}`} onClick={() => setTab("import")}>Import</button>
      <button className={`tb${tab === "fb" ? " on" : ""}`} onClick={() => setTab("fb")}>Feedback{feedback.filter(f => f.status === "new").length > 0 && <span className="nd or">{feedback.filter(f => f.status === "new").length}</span>}</button>
    </div>

    {/* ── DASHBOARD ── */}
    {tab === "dash" && <>
      <div className="stw">
        <div className="stc"><div className="sv sa">{events.length}</div><div className="svl">Events</div></div>
        <div className="stc"><div className="sv sg">{profiles.filter(p => p.approved && p.role === "staff").length}</div><div className="svl">Active Staff</div></div>
        <div className="stc" style={{cursor:"pointer"}} onClick={() => setTab("staff")} title="Click to review"><div className="sv so">{pendingAccounts.length}</div><div className="svl">Pending Accts {pendingAccounts.length > 0 && "→"}</div></div>
        <div className="stc" style={{cursor:"pointer"}} onClick={() => setTab("events")} title="Click to review"><div className="sv sy">{pendingSignups.length}</div><div className="svl">Pending Signups {pendingSignups.length > 0 && "→"}</div></div>
        <div className="stc" style={{cursor:"pointer"}} onClick={() => setTab("cr")} title="Click to review"><div className="sv" style={{color:"var(--r)"}}>{pendingCR.length}</div><div className="svl">Withdrawals {pendingCR.length > 0 && "→"}</div></div>
        <div className="stc"><div className="sv sg">{attendance.filter(a => a.sign_out_time).reduce((s, a) => s + (parseFloat(calcHours(a.sign_in_time, a.sign_out_time)) || 0), 0).toFixed(0)}</div><div className="svl">Total Hrs</div></div>
      </div>

      {(pendingAccounts.length > 0 || pendingSignups.length > 0 || pendingCR.length > 0) && (
        <div style={{background:"var(--s)",border:"1px solid var(--bd)",borderRadius:10,padding:14,marginBottom:12}}>
          <div className="sct" style={{marginBottom:8}}>🔔 Pending Actions</div>
          {pendingAccounts.map(a => (
            <div key={a.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"6px 0",borderBottom:"1px solid var(--bd)"}}>
              <div>
                <span style={{fontWeight:500}}>{a.name}</span>
                <span style={{fontSize:10,color:"var(--t2)",marginLeft:6}}>{a.level} · Shift {a.shift}</span>
                <span style={{fontSize:10,background:"rgba(251,146,60,.15)",color:"var(--o)",borderRadius:4,padding:"1px 5px",marginLeft:6}}>New Registration</span>
              </div>
              <button className="bt bts btg" style={{fontSize:10}} onClick={() => setTab("staff")}>Review →</button>
            </div>
          ))}
          {pendingSignups.map(s => {
            const ac = profiles.find(p => p.id === s.staff_id);
            const ev = events.find(e => e.id === s.event_id);
            if (!ac || !ev) return null;
            return (
              <div key={s.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"6px 0",borderBottom:"1px solid var(--bd)"}}>
                <div>
                  <span style={{fontWeight:500}}>{ac.name}</span>
                  <span style={{fontSize:10,color:"var(--t2)",marginLeft:6}}>{ac.level} · {fmtDate(ev.date)}</span>
                  <span style={{fontSize:10,background:"rgba(251,191,36,.15)",color:"var(--y)",borderRadius:4,padding:"1px 5px",marginLeft:6}}>{ev.name}</span>
                </div>
                <button className="bt bts bta" style={{fontSize:10}} onClick={() => { setTab("events"); setSelEv(ev.id); }}>Review →</button>
              </div>
            );
          })}
          {pendingCR.map(c => {
            const ac = profiles.find(p => p.id === c.staff_id);
            const ev = events.find(e => e.id === c.event_id);
            if (!ac || !ev) return null;
            return (
              <div key={c.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"6px 0",borderBottom:"1px solid var(--bd)"}}>
                <div>
                  <span style={{fontWeight:500}}>{ac.name}</span>
                  <span style={{fontSize:10,color:"var(--t2)",marginLeft:6}}>{fmtDate(ev.date)}</span>
                  <span style={{fontSize:10,background:"rgba(239,68,68,.15)",color:"var(--r)",borderRadius:4,padding:"1px 5px",marginLeft:6}}>Wants to withdraw from {ev.name}</span>
                </div>
                <button className="bt bts btr" style={{fontSize:10}} onClick={() => setTab("cr")}>Review →</button>
              </div>
            );
          })}
        </div>
      )}

      <div className="dbr">
        <button className="bt bp" onClick={exportAttendance}>📥 Export Attendance CSV</button>
        <button className="bt bp" onClick={exportStaffHours}>📥 Export Staff Hours CSV</button>
      </div>

      <div className="af">
        <div className="sct">Staff Hours Leaderboard</div>
        {staffHours.length === 0 && <div style={{ color: "var(--t2)", fontSize: 12 }}>No completed attendance records yet.</div>}
        <table className="lt">
          <thead><tr><th>Name</th><th>Level</th><th>Shift</th><th>Hours</th><th>Events</th></tr></thead>
          <tbody>
            {staffHours.slice(0, 20).map(s => (
              <tr key={s.id}>
                <td style={{ fontWeight: 500 }}>{s.name}</td>
                <td>{s.level}</td><td>{s.shift}</td>
                <td style={{ color: "var(--g)", fontWeight: 600 }}>{s.total.toFixed(1)}</td>
                <td>{s.events}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>}

    {/* ── EVENTS ── */}
    {tab === "events" && <>
      <div className="af">
        <div className="sct">Create Event</div>
        <div className="fg"><label className="fl">Event Name *</label><input className="fi" value={addEv.name} onChange={e => setAddEv(p => ({ ...p, name: e.target.value }))} /></div>
        <div className="fr">
          <div className="fg"><label className="fl">Date *</label><input className="fi" type="date" value={addEv.date} onChange={e => setAddEv(p => ({ ...p, date: e.target.value }))} /></div>
          <div className="fg"><label className="fl">Start *</label><input className="fi" type="time" value={addEv.time_start} onChange={e => setAddEv(p => ({ ...p, time_start: e.target.value }))} /></div>
        </div>
        <div className="fr">
          <div className="fg"><label className="fl">End *</label><input className="fi" type="time" value={addEv.time_end} onChange={e => setAddEv(p => ({ ...p, time_end: e.target.value }))} /></div>
          <div className="fg"><label className="fl">Venue</label><input className="fi" value={addEv.venue} onChange={e => setAddEv(p => ({ ...p, venue: e.target.value }))} placeholder="e.g. Regions Field" /></div>
        </div>
        <div className="fg"><label className="fl">Location / Address</label><input className="fi" value={addEv.location} onChange={e => setAddEv(p => ({ ...p, location: e.target.value }))} placeholder="e.g. 1401 1st Ave S, Birmingham, AL" /></div>
        <div className="fr">
          <div className="fg"><label className="fl">Paramedics Needed</label><input className="fi" type="number" min="0" value={addEv.needed_paramedics} onChange={e => setAddEv(p => ({ ...p, needed_paramedics: e.target.value }))} /></div>
          <div className="fg"><label className="fl">EMTs Needed</label><input className="fi" type="number" min="0" value={addEv.needed_emts} onChange={e => setAddEv(p => ({ ...p, needed_emts: e.target.value }))} /></div>
        </div>
        <div className="fg"><label className="fl">Notes / Instructions</label><textarea className="ta" value={addEv.notes} onChange={e => setAddEv(p => ({ ...p, notes: e.target.value }))} placeholder="Staging area, gear requirements, special instructions..." /></div>
        <button className="bt bta" onClick={createEvent}>Create Event</button>
      </div>

      {events.map(ev => {
        const es = signups.filter(s => s.event_id === ev.id && s.status === "confirmed");
        const pendEv = signups.filter(s => s.event_id === ev.id && s.status === "pending");
        const pc = es.filter(s => { const p = profiles.find(x => x.id === s.staff_id); return p?.level === "Paramedic"; }).length;
        const ec = es.filter(s => { const p = profiles.find(x => x.id === s.staff_id); return p?.level === "EMT"; }).length;
        const att = attendance.filter(a => a.event_id === ev.id);
        const isEdit = editEv?.id === ev.id;

        return (
          <div className="evc" key={ev.id}>
            {isEdit ? (
              <div>
                <div className="sct">Edit Event</div>
                <div className="fg"><label className="fl">Name</label><input className="fi" value={editEv.name} onChange={e => setEditEv(p => ({ ...p, name: e.target.value }))} /></div>
                <div className="fr">
                  <div className="fg"><label className="fl">Date</label><input className="fi" type="date" value={editEv.date} onChange={e => setEditEv(p => ({ ...p, date: e.target.value }))} /></div>
                  <div className="fg"><label className="fl">Venue</label><input className="fi" value={editEv.venue} onChange={e => setEditEv(p => ({ ...p, venue: e.target.value }))} /></div>
                </div>
                <div className="fr">
                  <div className="fg"><label className="fl">Start</label><input className="fi" type="time" value={editEv.time_start} onChange={e => setEditEv(p => ({ ...p, time_start: e.target.value }))} /></div>
                  <div className="fg"><label className="fl">End</label><input className="fi" type="time" value={editEv.time_end} onChange={e => setEditEv(p => ({ ...p, time_end: e.target.value }))} /></div>
                </div>
                <div className="fg"><label className="fl">Location</label><input className="fi" value={editEv.location} onChange={e => setEditEv(p => ({ ...p, location: e.target.value }))} /></div>
                <div className="fr">
                  <div className="fg"><label className="fl">Paramedics</label><input className="fi" type="number" min="0" value={editEv.needed_paramedics} onChange={e => setEditEv(p => ({ ...p, needed_paramedics: e.target.value }))} /></div>
                  <div className="fg"><label className="fl">EMTs</label><input className="fi" type="number" min="0" value={editEv.needed_emts} onChange={e => setEditEv(p => ({ ...p, needed_emts: e.target.value }))} /></div>
                </div>
                <div className="fg"><label className="fl">Notes</label><textarea className="ta" value={editEv.notes} onChange={e => setEditEv(p => ({ ...p, notes: e.target.value }))} /></div>
                <div className="pa"><button className="bt bts btg" onClick={saveEventEdit}>Save</button><button className="bt bts bp" onClick={() => setEditEv(null)}>Cancel</button></div>
              </div>
            ) : (<>
              <div className="evh">
                <div>
                  <div className="evn">{ev.name} <StatusBadge status={ev.status} /></div>
                  <div className="evm">{fmtDate(ev.date)} · {fmtTime(ev.time_start)} – {fmtTime(ev.time_end)} · <span className="sts" style={{background:"rgba(167,139,250,.2)",color:"var(--p)"}}>Shift {getShiftForDate(ev.date)}</span></div>
                  {(ev.venue || ev.location) && <div className="loc">
                    {ev.venue && <span style={{ fontWeight: 500, color: "var(--t)" }}>{ev.venue}</span>}
                    {ev.venue && ev.location && " · "}
                    {ev.location && <a href={`https://maps.google.com/?q=${encodeURIComponent(ev.location)}`} target="_blank" rel="noopener noreferrer">{ev.location}</a>}
                  </div>}
                </div>
                <div className="evb">
                  <button className="bt bts bp" onClick={() => setSelEv(selEv === ev.id ? null : ev.id)}>{selEv === ev.id ? "Hide" : "Manage"}</button>
                  <button className="bt bts bp" onClick={() => setEditEv({ id: ev.id, name: ev.name, date: ev.date, time_start: ev.time_start, time_end: ev.time_end, location: ev.location || "", venue: ev.venue || "", notes: ev.notes || "", needed_paramedics: ev.needed_paramedics, needed_emts: ev.needed_emts })}>Edit</button>
                  <select className="sel" style={{ width: "auto", padding: "4px 8px", fontSize: 10 }} value={ev.status} onChange={e => updateEventStatus(ev.id, e.target.value)}>
                    <option value="open">Open</option><option value="full">Full</option><option value="closed">Closed</option><option value="cancelled">Cancelled</option>
                  </select>
                  <button className="bt bts btr" onClick={() => deleteEvent(ev.id)}>Del</button>
                </div>
              </div>
              {ev.notes && <div className="nts">📋 {ev.notes}</div>}
              <div className="slb">
                <div className="sb"><div className="sl"><span>Medics</span><span>{pc}/{ev.needed_paramedics}</span></div><div className="st"><div className={`sf p${pc >= ev.needed_paramedics ? " fu" : ""}`} style={{ width: `${Math.min(100, (pc / (ev.needed_paramedics || 1)) * 100)}%` }} /></div></div>
                <div className="sb"><div className="sl"><span>EMT</span><span>{ec}/{ev.needed_emts}</span></div><div className="st"><div className={`sf e${ec >= ev.needed_emts ? " fu" : ""}`} style={{ width: `${Math.min(100, (ec / (ev.needed_emts || 1)) * 100)}%` }} /></div></div>
              </div>
              {selEv === ev.id && (
                <div style={{ marginTop: 14 }}>
                  {pendEv.length > 0 && (() => {
                    const recommended = getRecommended(pendEv, profiles, ev, signups, events);
                    const sorted = [...pendEv].sort((a, b) => {
                      const sa = scoreSignup(a, profiles.find(p=>p.id===a.staff_id)||{}, ev, signups, events);
                      const sb = scoreSignup(b, profiles.find(p=>p.id===b.staff_id)||{}, ev, signups, events);
                      return sb - sa;
                    });
                    return (
                    <div className="pend-section">
                      <div className="sct" style={{ color: "var(--o)" }}>⏳ Pending Approval ({pendEv.length})</div>
                      <div style={{ fontSize: 10, color: "var(--t2)", marginBottom: 8 }}>⭐ = App recommendation based on credential, duty status, and workload this month</div>
                      {sorted.map(s => {
                        const ac = profiles.find(p => p.id === s.staff_id); if (!ac) return null;
                        const onShift = getShiftForDate(ev.date) === ac.shift;
                        const gettingOff = getShiftForDate(ev.date) === NEXT_SHIFT[ac.shift];
                        const conflicts = findAllOverlaps(ev.id, s.staff_id, events, signups);
                        const isRec = recommended.has(s.id);
                        const monthlyCount = signups.filter(su => su.staff_id === ac.id && su.status === "confirmed").length;
                        return (
                          <div className="srow" key={s.id} style={isRec ? { borderLeft: "3px solid var(--g)", paddingLeft: 8 } : {}}>
                            <div>
                              <div className="sn">
                                {isRec && <span style={{ color: "var(--g)", marginRight: 4 }}>⭐</span>}
                                {ac.name}
                                {onShift && <span style={{ color: "var(--o)", fontSize: 10, marginLeft: 4 }}>⚠️ On duty</span>}
                                {gettingOff && <span style={{ color: "var(--a)", fontSize: 10, marginLeft: 4 }}>ℹ️ Off 0800</span>}
                              </div>
                              <div className="sme">{ac.level} · Shift {ac.shift} · {monthlyCount} event{monthlyCount !== 1 ? "s" : ""} this month · Signed up {fmtDateTime(s.signed_up_at)}</div>
                              {conflicts.length > 0 && <div style={{ fontSize: 10, marginTop: 2 }}>{conflicts.map((c, i) => <span key={i} style={{ color: c.signupStatus === "confirmed" ? "var(--r)" : "var(--o)", marginRight: 6 }}>{c.signupStatus === "confirmed" ? "🚫" : "⚡"} {c.name} ({c.signupStatus})</span>)}</div>}
                            </div>
                            <div style={{ display: "flex", gap: 4 }}><button className="bt bts btg" onClick={() => approveSignup(s.id)}>Approve</button><button className="bt bts btr" onClick={() => denySignup(s.id)}>Deny</button></div>
                          </div>
                        );
                      })}
                    </div>
                    );
                  })()}
                  )}
                  <div className="dv" /><div className="sct">Approved Staff ({es.length})</div>
                  {es.length === 0 && <div style={{ color: "var(--t2)", fontSize: 12 }}>None yet.</div>}
                  {es.map(s => {
                    const ac = profiles.find(p => p.id === s.staff_id); if (!ac) return null;
                    const at2 = att.find(a => a.staff_id === s.staff_id);
                    return (
                      <div className="srow" key={s.id}>
                        <div>
                          <div className="sn">{ac.name}</div>
                          <div className="sme">{ac.level} · Shift {ac.shift}</div>
                          {at2 && <div style={{ marginTop: 3 }}>
                            <span className="bg si">IN: {fmtDateTime(at2.sign_in_time)}</span>
                            {at2.sign_out_time && <span className="bg so2" style={{ marginLeft: 3 }}>OUT: {fmtDateTime(at2.sign_out_time)}</span>}
                          </div>}
                        </div>
                        <div style={{ display: "flex", gap: 4 }}>
                          {!at2 && <button className="bt bts bta" onClick={() => coordSignIn(s.staff_id, ev.id)}>Clock In</button>}
                          {at2 && !at2.sign_out_time && <button className="bt bts btg" onClick={() => coordSignOut(s.staff_id, ev.id)}>Clock Out</button>}
                          <button className="bt bts btr" onClick={() => coordRemoveSignup(s.staff_id, ev.id)}>Remove</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>)}
          </div>
        );
      })}
    </>}

    {/* ── STAFF TAB ── */}
    {tab === "staff" && <>
      {pendingAccounts.length > 0 && <>
        <div className="sct" style={{ color: "var(--y)" }}>Pending Approval ({pendingAccounts.length})</div>
        <div className="bulk-bar">
          <button className="bt btg" onClick={approveAll}>✓ Approve All ({pendingAccounts.length})</button>
        </div>
        {pendingAccounts.map(a => (
          <div className="pcd" key={a.id}>
            <div className="pcn">{a.name}</div>
            <div className="pcm">{a.email} · {a.level} · Shift {a.shift} · {a.phone}</div>
            <div className="pa">
              <button className="bt bts btg" onClick={() => approveAccount(a.id)}>Approve</button>
              <button className="bt bts btr" onClick={() => denyAccount(a.id)}>Deny</button>
            </div>
          </div>
        ))}
        <div className="dv" />
      </>}
      <div className="sct">Active Staff ({profiles.filter(a => a.approved).length})</div>
      <div className="cd"><table className="lt">
        <thead><tr><th>Name</th><th>Email</th><th>Level</th><th>Shift</th><th>Phone</th><th>Role</th></tr></thead>
        <tbody>{profiles.filter(a => a.approved).map(a => (
          <tr key={a.id}>
            <td style={{ fontWeight: 500 }}>{a.name}</td>
            <td style={{ color: "var(--t2)" }}>{a.email}</td>
            <td>{a.level || "—"}</td>
            <td>{a.shift || "—"}</td>
            <td style={{ color: "var(--t2)" }}>{a.phone || "—"}</td>
            <td>
              <span className={`rb${a.role === "coordinator" ? " co" : ""}`}>{a.role}</span>
              {a.id !== profile.id && (
                a.role === "staff"
                  ? <button className="bt bts btg" style={{marginLeft:4,fontSize:9,padding:"2px 6px"}} onClick={() => promoteToCoordinator(a.id)}>Promote</button>
                  : <button className="bt bts btr" style={{marginLeft:4,fontSize:9,padding:"2px 6px"}} onClick={() => demoteToStaff(a.id)}>Demote</button>
              )}
            </td>
          </tr>
        ))}</tbody>
      </table></div>
    </>}

    {/* ── ATTENDANCE TAB ── */}
    {tab === "att" && <>
      <div className="stw">
        <div className="stc"><div className="sv sa">{attendance.length}</div><div className="svl">Records</div></div>
        <div className="stc"><div className="sv sg">{attendance.filter(a => a.sign_out_time).reduce((s, a) => s + (parseFloat(calcHours(a.sign_in_time, a.sign_out_time)) || 0), 0).toFixed(1)}</div><div className="svl">Hours</div></div>
        <div className="stc"><div className="sv sy">{attendance.filter(a => !a.sign_out_time).length}</div><div className="svl">Active</div></div>
      </div>
      <button className="bt bp" style={{ marginBottom: 14 }} onClick={exportAttendance}>📥 Export CSV</button>
      <div className="cd"><table className="lt">
        <thead><tr><th>Staff</th><th>Event</th><th>Clock In</th><th>Clock Out</th><th>Hrs</th></tr></thead>
        <tbody>{attendance.map(a => {
          const ac = profiles.find(x => x.id === a.staff_id); const ev = events.find(x => x.id === a.event_id);
          return (<tr key={a.id}><td>{ac?.name || "?"}</td><td>{ev?.name || "?"}</td><td>{fmtDateTime(a.sign_in_time)}</td><td>{a.sign_out_time ? fmtDateTime(a.sign_out_time) : <span className="bg si">Active</span>}</td><td>{a.sign_out_time ? calcHours(a.sign_in_time, a.sign_out_time) + " hrs" : "—"}</td></tr>);
        })}</tbody>
      </table></div>
    </>}

    {/* ── CANCEL REQUESTS ── */}
    {tab === "cr" && <>
      <div className="stw">
        <div className="stc"><div className="sv so">{pendingCR.length}</div><div className="svl">Pending</div></div>
        <div className="stc"><div className="sv sg">{cancelReqs.filter(c => c.status === "approved").length}</div><div className="svl">Approved</div></div>
        <div className="stc"><div className="sv sr2">{cancelReqs.filter(c => c.status === "denied").length}</div><div className="svl">Denied</div></div>
      </div>
      {pendingCR.length === 0 && <div className="ey"><div className="ei">✅</div>No pending cancel requests.</div>}
      {pendingCR.map(c => {
        const ac = profiles.find(a => a.id === c.staff_id); const ev = events.find(e => e.id === c.event_id);
        const at2 = attendance.find(a => a.staff_id === c.staff_id && a.event_id === c.event_id);
        return (<div className="crc" key={c.id}>
          <div className="cn">{ac?.name} → {ev?.name}</div>
          <div className="cm">{ac?.level} · Shift {ac?.shift} · Requested: {fmtDateTime(c.requested_at)}
            {at2 && <><br />In: {fmtDateTime(at2.sign_in_time)}{at2.sign_out_time ? ` · Out: ${fmtDateTime(at2.sign_out_time)}` : " · Active"}</>}
          </div>
          <div className="pa"><button className="bt bts btg" onClick={() => approveCR(c.id)}>Approve</button><button className="bt bts btr" onClick={() => denyCR(c.id)}>Deny</button></div>
        </div>);
      })}
      {cancelReqs.filter(c => c.status !== "pending").length > 0 && <>
        <div className="dv" /><div className="sct">History</div>
        {cancelReqs.filter(c => c.status !== "pending").map(c => {
          const ac = profiles.find(a => a.id === c.staff_id); const ev = events.find(e => e.id === c.event_id);
          return (<div className="srow" key={c.id}><div><div className="sn">{ac?.name} → {ev?.name}</div><div className="sme">{fmtDateTime(c.requested_at)}</div></div><span className={`bg ${c.status === "approved" ? "cf" : "dn"}`}>{c.status}</span></div>);
        })}
      </>}
    </>}

    {/* ── ACTIVITY LOG ── */}
    {tab === "log" && <>
      <div className="sct">Activity Log (Last 200)</div>
      <div className="cd">
        {activityLog.length === 0 && <div style={{ color: "var(--t2)", fontSize: 12, padding: 10 }}>No activity recorded yet.</div>}
        {activityLog.map(l => {
          const actor = profiles.find(p => p.id === l.actor_id);
          return (
            <div className="alr" key={l.id}>
              <div className="alt">{fmtFull(l.created_at)}</div>
              <div>
                <div className="ala">
                  <span style={{ color: "var(--a)" }}>{actor?.name || "System"}</span>
                  {" "}<span style={{ color: "var(--t2)" }}>{l.action.replace(/_/g, " ")}</span>
                  {" "}<span style={{ color: "var(--t2)", fontSize: 10 }}>({l.target_type})</span>
                </div>
                {l.details && Object.keys(l.details).length > 0 && (
                  <div className="ald">{Object.entries(l.details).map(([k, v]) => `${k}: ${v}`).join(" · ")}</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </>}

    {/* ── IMPORT TAB ── */}
    {tab === "import" && <>
      <div className="ur">
        <div className="sct">Import Events from Excel</div>
        <div className="urf" onClick={() => fileRef.current?.click()}>
          <div style={{ fontSize: 28 }}>📊</div><p>Click to upload .xlsx file</p>
          <input ref={fileRef} type="file" accept=".xlsx,.xls" style={{ display: "none" }} onChange={handleUpload} />
        </div>
        {upRes && !previewEvs && (<div style={{ marginTop: 12 }}>
          <div style={{ color: "var(--g)", fontSize: 13, fontWeight: 600 }}>✅ {upRes.count} events imported successfully</div>
          {upRes.errors.length > 0 && <div style={{ color: "var(--o)", fontSize: 11, marginTop: 4 }}>{upRes.errors.join("; ")}</div>}
        </div>)}
      </div>

      {previewEvs && previewEvs.events.length > 0 && (
        <div className="af">
          <div className="sct">Preview — {previewEvs.events.length} Events Found</div>
          <div style={{ fontSize: 11, color: "var(--t2)", marginBottom: 10 }}>From: {previewEvs.fileName}</div>
          <div style={{ maxHeight: 300, overflowY: "auto" }}>
            <table className="lt">
              <thead><tr><th>Event</th><th>Date</th><th>Time</th><th>Venue</th></tr></thead>
              <tbody>{previewEvs.events.map((ev, i) => (
                <tr key={i}>
                  <td style={{ fontWeight: 500 }}>{ev.name}</td>
                  <td>{fmtDate(ev.date)}</td>
                  <td>{fmtTime(ev.time_start)} – {fmtTime(ev.time_end)}</td>
                  <td style={{ color: "var(--t2)" }}>{ev.venue || "—"}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
          {previewEvs.errors.length > 0 && <div style={{ color: "var(--o)", fontSize: 11, marginTop: 8 }}>Warnings: {previewEvs.errors.join("; ")}</div>}
          <div className="pa" style={{ marginTop: 14 }}>
            <button className="bt btg" onClick={confirmImport}>✓ Import {previewEvs.events.length} Events</button>
            <button className="bt bp" onClick={() => setPreviewEvs(null)}>Cancel</button>
          </div>
        </div>
      )}

      <div className="af">
        <div className="sct">Supported Formats</div>
        <div style={{ fontSize: 11, color: "var(--t2)", fontFamily: "'DM Mono', monospace", lineHeight: 1.8 }}>
          <strong style={{ color: "var(--a)" }}>Calendar Grid (BFRS style):</strong> Dates across top row, events stacked under each date with times below.<br />
          <strong style={{ color: "var(--a)" }}>Table Format:</strong> Columns: Event Name*, Date*, Start Time, End Time, Location, Venue, Notes, Paramedics Needed, EMTs Needed
        </div>
      </div>
    </>}

    {/* ── FEEDBACK TAB ── */}
    {tab === "fb" && <>
      <div className="stw">
        <div className="stc"><div className="sv so">{feedback.filter(f => f.status === "new").length}</div><div className="svl">New</div></div>
        <div className="stc"><div className="sv sg">{feedback.filter(f => f.status === "reviewed").length}</div><div className="svl">Reviewed</div></div>
        <div className="stc"><div className="sv sa">{feedback.length}</div><div className="svl">Total</div></div>
      </div>
      {feedback.length === 0 && <div className="ey"><div className="ei">📝</div>No feedback yet.</div>}
      {feedback.map(f => {
        const user = profiles.find(p => p.id === f.user_id);
        const typeIcon = f.type === "bug" ? "🐛" : f.type === "idea" ? "💡" : "💬";
        return (
          <div className="fb-item" key={f.id}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div><span style={{ fontSize: 14 }}>{typeIcon}</span> <span style={{ fontWeight: 600, fontSize: 13, textTransform: "capitalize" }}>{f.type}</span></div>
              <span className={`bg ${f.status === "new" ? "pc" : f.status === "reviewed" ? "si" : "cf"}`}>{f.status}</span>
            </div>
            <div style={{ margin: "8px 0", fontSize: 13, lineHeight: 1.5 }}>{f.message}</div>
            <div className="fb-meta">
              <span>{user?.name || "Unknown"} · {fmtDateTime(f.created_at)}</span>
              {f.status === "new" && <button className="bt bts btg" onClick={async () => {
                await supabase.from("feedback").update({ status: "reviewed" }).eq("id", f.id);
                notify("Marked as reviewed."); refresh();
              }}>Mark Reviewed</button>}
              {f.status === "reviewed" && <button className="bt bts bta" onClick={async () => {
                await supabase.from("feedback").update({ status: "resolved" }).eq("id", f.id);
                notify("Marked as resolved."); refresh();
              }}>Resolve</button>}
            </div>
          </div>
        );
      })}
    </>}
  </>);
}
function StaffView({ profile, notify }) {
  const { profiles, events, signups, attendance, cancelReqs, loading, refresh } = useData();
  const [tab, setTab] = useState("events");

  const mySignups = signups.filter(s => s.staff_id === profile.id && (s.status === "confirmed" || s.status === "pending"));
  const myAtt = attendance.filter(a => a.staff_id === profile.id);
  const myCR = cancelReqs.filter(c => c.staff_id === profile.id);
  const myEventIds = mySignups.map(s => s.event_id);
  const pendingCRCount = myCR.filter(c => c.status === "pending").length;

  const myTotalHours = useMemo(() => {
    return myAtt.filter(a => a.sign_out_time).reduce((s, a) => s + (parseFloat(calcHours(a.sign_in_time, a.sign_out_time)) || 0), 0);
  }, [myAtt]);

  const signUpForEvent = async (eventId) => {
    const ev = events.find(e => e.id === eventId);
    if (ev?.status !== "open") { notify("Event is not open for signups.", "error"); return; }
    if (mySignups.find(s => s.event_id === eventId)) { notify("Already signed up.", "error"); return; }
    if (mySignups.filter(s => s.status === "confirmed").length >= SOFT_LIMIT) { notify(`Soft limit of ${SOFT_LIMIT} approved events reached.`, "warn"); }
    // Check for overlapping approved events — warn but allow signup
    const conflicts = findConflicts(eventId, profile.id, events, signups);
    const { error } = await supabase.from("signups").insert({ staff_id: profile.id, event_id: eventId, status: "pending", signed_up_at: nowISO() });
    if (error) { notify(error.message, "error"); return; }
    await logActivity("signed_up", "signup", eventId, { eventName: ev?.name });
    sendNotification("event_signup", { staffName: profile.name, staffLevel: profile.level, eventName: ev?.name, eventDate: fmtDate(ev?.date) });
    if (conflicts.length > 0) {
      notify(`Signup sent! Note: overlaps with ${conflicts.map(c => c.name).join(", ")} — coordinator will decide.`, "warn");
    } else {
      notify("Signup request sent — awaiting approval.");
    }
    refresh();
  };

  const cancelSignup = async (eventId) => {
    const mySU = mySignups.find(s => s.event_id === eventId);
    if (!mySU) return;
    const ev = events.find(e => e.id === eventId);

    // Pending → just withdraw
    if (mySU.status === "pending") {
      await supabase.from("signups").delete().eq("id", mySU.id);
      await logActivity("withdrew_signup", "signup", eventId, { eventName: ev?.name });
      notify("Signup withdrawn."); refresh(); return;
    }

    // Confirmed → always requires coordinator approval
    const existingCR = myCR.find(c => c.event_id === eventId && c.status === "pending");
    if (existingCR) { notify("Withdrawal request already pending — awaiting coordinator approval.", "warn"); return; }
    await supabase.from("cancel_requests").insert({ staff_id: profile.id, event_id: eventId, status: "pending", requested_at: nowISO() });
    await logActivity("requested_cancel", "cancel_request", eventId, { eventName: ev?.name });
    sendNotification("cancel_request", { staffName: profile.name, eventName: ev?.name });
    notify("Withdrawal request sent — awaiting coordinator approval.", "warn");
    refresh();
  };

  const signIn = async (eventId) => {
    const myApproved = mySignups.find(s => s.event_id === eventId && s.status === "confirmed"); if (!myApproved) { notify("Not approved yet.", "error"); return; } if (myAtt.find(a => a.event_id === eventId)) { notify("Already clocked in.", "error"); return; }
    await supabase.from("attendance").insert({ staff_id: profile.id, event_id: eventId, sign_in_time: nowISO() });
    const ev = events.find(e => e.id === eventId);
    await logActivity("clocked_in", "attendance", eventId, { eventName: ev?.name });
    notify("Clocked in!"); refresh();
  };

  const signOut = async (eventId) => {
    const rec = myAtt.find(a => a.event_id === eventId && !a.sign_out_time);
    if (!rec) return;
    await supabase.from("attendance").update({ sign_out_time: nowISO() }).eq("id", rec.id);
    const ev = events.find(e => e.id === eventId);
    await logActivity("clocked_out", "attendance", eventId, { eventName: ev?.name });
    notify("Clocked out!"); refresh();
  };

  if (loading) return <div className="ld"><div className="spinner" /><span style={{ fontSize: 12 }}>Loading...</span></div>;

  // Only show events that aren't cancelled for staff
  const visibleEvents = events.filter(e => e.status !== "cancelled");

  return (<>
    <div className="tabs">
      <button className={`tb${tab === "events" ? " on" : ""}`} onClick={() => setTab("events")}>All Events</button>
      <button className={`tb${tab === "my" ? " on" : ""}`} onClick={() => setTab("my")}>My Events ({mySignups.length})</button>
      <button className={`tb${tab === "hours" ? " on" : ""}`} onClick={() => setTab("hours")}>My Hours</button>
      <button className={`tb${tab === "cr" ? " on" : ""}`} onClick={() => setTab("cr")}>Cancel Reqs{pendingCRCount > 0 && <span className="nd or">{pendingCRCount}</span>}</button>
    </div>

    {/* ── ALL EVENTS ── */}
    {tab === "events" && <>
      <div className="stw">
        <div className="stc"><div className="sv sa">{visibleEvents.length}</div><div className="svl">Events</div></div>
        <div className="stc"><div className="sv so">{mySignups.filter(s=>s.status==="pending").length}</div><div className="svl">Pending</div></div><div className="stc"><div className="sv sg">{mySignups.filter(s=>s.status==="confirmed").length}</div><div className="svl">Approved</div></div>
        <div className="stc"><div className="sv sy">{myTotalHours.toFixed(1)}</div><div className="svl">My Hours</div></div>
      </div>
      {visibleEvents.map(ev => {
        const es = signups.filter(s => s.event_id === ev.id && s.status === "confirmed");
        const pc = es.filter(s => { const p = profiles.find(x => x.id === s.staff_id); return p?.level === "Paramedic"; }).length;
        const ec = es.filter(s => { const p = profiles.find(x => x.id === s.staff_id); return p?.level === "EMT"; }).length;
        const myS = mySignups.find(s=>s.event_id===ev.id); const isMine = !!myS;
        const myAttRec = myAtt.find(a => a.event_id === ev.id);
        const conflicts = !isMine ? findConflicts(ev.id, profile.id, events, signups) : [];
        const hasConflict = conflicts.length > 0;
        const canSignUp = ev.status === "open" && !isMine;

        return (
          <div className="evc" key={ev.id} style={isMine ? { borderColor: myS?.status === "confirmed" ? "var(--g)" : "var(--o)" } : {}}>
            <div className="evh">
              <div>
                <div className="evn">{ev.name} <StatusBadge status={ev.status} /> {isMine && <SignupBadge status={myS?.status || "pending"} />} {isMine && myCR.find(c => c.event_id === ev.id && c.status === "pending") && <span className="bg so2">⏳ Withdrawal Pending</span>} {hasConflict && !isMine && <span className="bg so2">⚡ Overlap</span>}</div>
                <div className="evm">{fmtDate(ev.date)} · {fmtTime(ev.time_start)} – {fmtTime(ev.time_end)} · <span className="sts" style={{background:"rgba(167,139,250,.2)",color:"var(--p)"}}>Shift {getShiftForDate(ev.date)}</span></div>
                {(ev.venue || ev.location) && <div className="loc">
                  {ev.venue && <span style={{ fontWeight: 500, color: "var(--t)" }}>{ev.venue}</span>}
                  {ev.venue && ev.location && " · "}
                  {ev.location && <a href={`https://maps.google.com/?q=${encodeURIComponent(ev.location)}`} target="_blank" rel="noopener noreferrer">{ev.location}</a>}
                </div>}
              </div>
              <div className="evb">
                {canSignUp && <button className="bt bts bta" onClick={() => signUpForEvent(ev.id)}>Sign Up</button>}
                {myS?.status === "confirmed" && !myAttRec && <button className="bt bts btg" onClick={() => signIn(ev.id)}>Clock In</button>}
                {isMine && myAttRec && !myAttRec.sign_out_time && <button className="bt bts bto" onClick={() => signOut(ev.id)}>Clock Out</button>}
                {isMine && !myCR.find(c => c.event_id === ev.id && c.status === "pending") && <button className="bt bts btr" onClick={() => cancelSignup(ev.id)}>{myS?.status === "pending" ? "Withdraw" : "Cancel"}</button>}
              </div>
            </div>
            {ev.notes && <div className="nts">📋 {ev.notes}</div>}
            {(() => { const evShift = getShiftForDate(ev.date); const offDay = NEXT_SHIFT[profile.shift]; if (evShift === profile.shift) return <div className="shift-warn">⚠️ Reminder: You will be on regular duty (Shift {profile.shift}) this day.</div>; if (evShift === offDay && ev.time_start < "08:00") return <div className="shift-warn">⚠️ You're getting off duty at 0800 (Shift {profile.shift}). Event starts before 0800 — you may arrive late.</div>; if (evShift === offDay) return <div className="shift-warn" style={{borderColor:"rgba(0,212,255,.2)",color:"var(--a)"}}>ℹ️ You're getting off duty at 0800 (Shift {profile.shift}). Event starts after your shift ends.</div>; return null; })()}
            {hasConflict && !isMine && <div className="shift-warn">⚡ Overlaps with: {conflicts.map(c => c.name).join(", ")}. You can still sign up — coordinator will decide which event to assign you.</div>}
            <div className="slb">
              <div className="sb"><div className="sl"><span>Medics</span><span>{pc}/{ev.needed_paramedics}</span></div><div className="st"><div className={`sf p${pc >= ev.needed_paramedics ? " fu" : ""}`} style={{ width: `${Math.min(100, (pc / (ev.needed_paramedics || 1)) * 100)}%` }} /></div></div>
              <div className="sb"><div className="sl"><span>EMT</span><span>{ec}/{ev.needed_emts}</span></div><div className="st"><div className={`sf e${ec >= ev.needed_emts ? " fu" : ""}`} style={{ width: `${Math.min(100, (ec / (ev.needed_emts || 1)) * 100)}%` }} /></div></div>
            </div>
            {myAttRec && (
              <div style={{ marginTop: 8, fontSize: 11, color: "var(--t2)", fontFamily: "'DM Mono', monospace" }}>
                In: {fmtDateTime(myAttRec.sign_in_time)}{myAttRec.sign_out_time && ` · Out: ${fmtDateTime(myAttRec.sign_out_time)} · ${calcHours(myAttRec.sign_in_time, myAttRec.sign_out_time)} hrs`}
              </div>
            )}
          </div>
        );
      })}
    </>}

    {/* ── MY EVENTS ── */}
    {tab === "my" && <>
      {mySignups.length === 0 && <div className="ey"><div className="ei">📋</div>No signups yet. Browse events to get started.</div>}
      {mySignups.map(s => {
        const ev = events.find(e => e.id === s.event_id); if (!ev) return null;
        const myAttRec = myAtt.find(a => a.event_id === ev.id);
        const isApproved = s.status === "confirmed";
        const isPending = s.status === "pending";
        return (
          <div className="evc" key={s.id} style={{ borderColor: isApproved ? "var(--g)" : "var(--o)" }}>
            <div className="evh">
              <div>
                <div className="evn">{ev.name} <SignupBadge status={s.status} /></div>
                <div className="evm">{fmtDate(ev.date)} · {fmtTime(ev.time_start)} – {fmtTime(ev.time_end)} · <span className="sts" style={{background:"rgba(167,139,250,.2)",color:"var(--p)"}}>Shift {getShiftForDate(ev.date)}</span></div>
                {(ev.venue || ev.location) && <div className="loc">
                  {ev.venue && <span style={{ fontWeight: 500, color: "var(--t)" }}>{ev.venue}</span>}
                  {ev.venue && ev.location && " · "}
                  {ev.location && <a href={`https://maps.google.com/?q=${encodeURIComponent(ev.location)}`} target="_blank" rel="noopener noreferrer">{ev.location}</a>}
                </div>}
              </div>
              <div className="evb">
                {isApproved && !myAttRec && <button className="bt bts btg" onClick={() => signIn(ev.id)}>Clock In</button>}
                {isApproved && myAttRec && !myAttRec.sign_out_time && <button className="bt bts bto" onClick={() => signOut(ev.id)}>Clock Out</button>}
                <button className="bt bts btr" onClick={() => cancelSignup(ev.id)}>{isPending ? "Withdraw" : "Cancel"}</button>
              </div>
            </div>
            {ev.notes && <div className="nts">📋 {ev.notes}</div>}
            {(() => { const evShift = getShiftForDate(ev.date); const offDay = NEXT_SHIFT[profile.shift]; if (evShift === profile.shift) return <div className="shift-warn">⚠️ Reminder: You will be on regular duty (Shift {profile.shift}) this day.</div>; if (evShift === offDay && ev.time_start < "08:00") return <div className="shift-warn">⚠️ You're getting off duty at 0800 (Shift {profile.shift}). Event starts before 0800 — you may arrive late.</div>; if (evShift === offDay) return <div className="shift-warn" style={{borderColor:"rgba(0,212,255,.2)",color:"var(--a)"}}>ℹ️ You're getting off duty at 0800 (Shift {profile.shift}). Event starts after your shift ends.</div>; return null; })()}
            {myAttRec && (
              <div style={{ marginTop: 8, fontSize: 11, color: "var(--t2)", fontFamily: "'DM Mono', monospace" }}>
                In: {fmtDateTime(myAttRec.sign_in_time)}{myAttRec.sign_out_time && ` · Out: ${fmtDateTime(myAttRec.sign_out_time)} · ${calcHours(myAttRec.sign_in_time, myAttRec.sign_out_time)} hrs`}
              </div>
            )}
          </div>
        );
      })}
    </>}

    {/* ── MY HOURS ── */}
    {tab === "hours" && <>
      <div className="stw">
        <div className="stc"><div className="sv sg">{myTotalHours.toFixed(1)}</div><div className="svl">Total Hours</div></div>
        <div className="stc"><div className="sv sa">{myAtt.filter(a => a.sign_out_time).length}</div><div className="svl">Completed</div></div>
        <div className="stc"><div className="sv sy">{myAtt.filter(a => !a.sign_out_time).length}</div><div className="svl">Active</div></div>
      </div>
      <div className="cd"><table className="lt">
        <thead><tr><th>Event</th><th>Date</th><th>Clock In</th><th>Clock Out</th><th>Hrs</th></tr></thead>
        <tbody>{myAtt.map(a => {
          const ev = events.find(x => x.id === a.event_id);
          return (<tr key={a.id}><td>{ev?.name || "?"}</td><td>{fmtDate(ev?.date)}</td><td>{fmtDateTime(a.sign_in_time)}</td><td>{a.sign_out_time ? fmtDateTime(a.sign_out_time) : <span className="bg si">Active</span>}</td><td>{a.sign_out_time ? calcHours(a.sign_in_time, a.sign_out_time) + " hrs" : "—"}</td></tr>);
        })}</tbody>
      </table></div>
    </>}

    {/* ── CANCEL REQUESTS ── */}
    {tab === "cr" && <>
      {myCR.length === 0 && <div className="ey"><div className="ei">✅</div>No cancel requests.</div>}
      {myCR.map(c => {
        const ev = events.find(e => e.id === c.event_id);
        return (<div className="srow" key={c.id}>
          <div><div className="sn">{ev?.name || "?"}</div><div className="sme">Requested: {fmtDateTime(c.requested_at)}</div></div>
          <span className={`bg ${c.status === "pending" ? "pc" : c.status === "approved" ? "cf" : "dn"}`}>
            {c.status === "pending" ? "⏳ Pending" : c.status === "approved" ? "✓ Approved" : "✗ Denied"}
          </span>
        </div>);
      })}
    </>}
  </>);
}
