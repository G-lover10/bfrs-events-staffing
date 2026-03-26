import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { createClient } from "@supabase/supabase-js";

// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║  BFRS Special Events Staffing v0.4 — Supabase Edition                       ║
// ║  Replace YOUR_SUPABASE_URL and YOUR_SUPABASE_ANON_KEY below                 ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

const SUPABASE_URL = "https://tohhqssnngvavkkeqzfl.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRvaGhxc3Nubmd2YXZra2VxemZsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ1NDg2NTAsImV4cCI6MjA5MDEyNDY1MH0.3mma-zOBQ63AM7FgHjRrKrnB_MX1FljnJPCrpmAMbIc";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const APP_VERSION = "0.4.0";
const SOFT_LIMIT = 4;
const BADGE_SRC = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACQAAAAwCAIAAAD2JU9CAAABMmlDQ1BJQ0MgUHJvZmlsZQAAeJx9kD9Lw0AYxn+Wgv8H0dEhYxelKuigLlUsOkmNYHVK0zQVmhiSlCK4+QX8EIKzowi6CjoIgpvgRxAH1/qkQdIlvsd797vnHu7ufaEwhqJYBs+Pw1q1YhzVj43RT0Y0BmHZUUB+yPXznnrfFv7x5cV404lsrV/KZqjHdaUpnnNTbifcSPki4V4cxOKrhEOztiW+FpfcIW4MsR2Eif9FvOF1unb2b6Yc//BA645ynm1OiQjoYHGOwT4rmqvaeXSJxT05YtqiiJpOKiKTUA5fSgtHTNK/9InLD9h86Pf795m29wi3azBxl2mldZiZhKfnTMt6GlihNZCKykKrBd83MF2H2Vfdc/LXyJzajEFtVc40XNXmSNnVf20WRcuUWWL1Fx+iTfmvd1mpAAANMUlEQVR42rVYSYxc13U9977669eveeiBzW6SzUEipeZg0ZLMCLIGQ04sWbETO4lg2EgCZxEYSTbeJVkZSLLJBGQCDCeLOHY8yYFjRBFp2bIkmKIiWgopShQptjg2u5vNHqqrqqv+8N69WVSzSUpCssrbVBU+6p537z3v3PMuqSrev1RUFGAy9L5nGZABCjCQA8xtDwWqnphABLz3v3Q7mKoI9CaGl+vp7Pnk0rvJ5Qvp3LxfXHHtNXUOKmSYy5FtNoOR4dzElvzkrvyWXSacWMdQqAxQeePlN8BUVYTM+jbT9pnu60e7L7/cO/lOemVRVhPNQGAQEzMw2PVgZ6LwMErFIBivRXdtL37k3uqhR/Jj+4EQgHohBohvARtAY6X9X8+t/Ocz3aMns5k2OcNhnvKWDIMAKADV9S8A0Xr8BIV61cxpmnpJ7VBU+PDO2uO/WH348aC485bIREDkOpeWf/Kd5e88G5++ArJcKZjQauqRiPY8coz/cxHgQYZQssoqSeI7vXC8Vn3y4eanPxdtvhcAiXNkzPy3/vjKl78WTW0xm/P+eiYkbMiOGBJoV7Lz6W3FphuxbQTmAVVqGKoa7amsOIrYbM7Lm71seanyG/t3/dUPIWZ9yybfzJUrlLNeti8XYjmXmIhkWfpnYjNpYQEFiNYhna5XjQAGPMjCTOaRZ5nJsOJMzQZbA1lOkGdbKdnSMGBUdR3M1msaiCw4nfd2Mqj8ZlVr7NZ8+KFCfDKWRFWAWOEgTmkkUK/wqqlqR2jEhB8vK4umSqMBNQ0UbjrBrCOQ+Mw2aoNjYQebNdU6cgYqNG55IpCWNwXCqCHnc3vycpA5T/66J1EOVCxTmvPzmS0wE2TMauy9l/wjJSakp/pQgkLVC0NVbaO+HtIgMaZSI8MoW6qxX9L0UmaGDI8EWMh8y4FBWwNbINclKsEWmGo2axiTZ/QFqhSr3ZpDx7lY8vdH2azLukLGohxgFbZWGbDRggiALVWRt9p10hWyRAJ/LXNnYoCISb1m7yRcYS1bhhECllPuSu+tHjUCyiBtZ3bmkulEFelrfeoplJSUV5UAW2+sRzb44GLFRmFWILMrkhAy60xIRKp161cdG5a+o6FQFpI4Yl3x5KA9MbsjbTkdZrOrIKHSqOUVT5Z9AdQT9SynE7Jsqo3BsbQDdTFR2dQiN92hFBxAhdQwYsWKs3Wj51NjCddiUzHoQKYdE5SJrSCB9ATq0PMUEjKSwFNIlAoypVg1b0y1NjgvdnBo2JS4UkKyol1DqZLvD7iuK8Icgrw6QcFQW/0ZR6pKBFFVIqOsIGGySh5ENJBwyhdgCAqOcqZY24hscIbyplqEKgHSsPLU5yUoM7wq1CiVgVRkTUxGUZ6JVFWh4r3GTmigWwMZU4VCXB//8ZNgJVGBKeY5Km/UbJ2PtlpRFSiIsXbXoaw4QS4BM1TFgZitRSv1Ry4nSsSKVDBRxKMTUSaqwA1IJQ7S7nz18PM5hYiYct5EpYHQ2EFfIbCp11U9mJE4Xl0mrpOLlZhAZUu9xLOjTit794XTI8ZmwkkW9yfKjw7vQZKWA5OJpgpSpSCnK9dNkpJhJI7LRebioCg3FdbWqwwFkWaOsgzGgJnYOPCR2STmXCkXgAnduVy/O16Yj5IVSjs5Y4qF6EdLONvnvGUhUmPJZUidEkF8UK0C4aBZ8HpvAUy1OhAv8kJJDCZRFCyOXU+fPTrzd4ffenkhKYRhp+/u3rN4967pWKwhWbGFvzl++UfPvfn9c2sJWwYURGmfMg9mFW8bZYAHfYzXVRywtbqygoi8IF5TohxhIaOjZ5cesG50pfONp3/690cvNqsr+yfPt7r5UhRMd5I/efql1eOnH4kCd3Hu8IIrW1Y26PdZFICScK06YM462IAhQb1JOVaFilDSU8Aw/+Cd7tDymskF1erwQ6Pbo+kLpt9zQBIbcJSbvTzV1b0Td7Rt7gD0xRNz0y7net324qzV9T5h6/UbEAPqgwBwuWbCAE6hoH7MhFR1wvhz/aW5thsZGtewuH/yjlZ3cnru7UL+7eHGvtHmRzmwqkjaK3NrK1Oje5aXFrtxa5sReEVAYLWN5kalbqbRFMsILQbsT3pEpCKfuKv2ySf2R02cv3Ky212OnRQie3Zm77ZNbuempdjnsqw3t/Du9Wz+I48d+PT+qs6eGx4fKVsjzgOAIVurb0DcZKMpVriUU1ECcX8NEAXFmdu7qfzLv/JLS9t2nDp3VF1LUNg6fL7TK707uyPK+/mZ08eWL+/95JNTw4VTJ14bHR+vlEvS7QIMVQqNKQ+0igC9mUbKl7hc9NICGHGsUAb1Yf757MrPjp0qzJ6OW+de+tnpffu+sHdre/qSeMmLTzZN7Huofe3wt7+/vLP00f27arWq9576a0SkohxaW6ndHtlAHrloS0X1AgL6MVSsMV+f7r3x4tlDJgrdUre/stpZfOvcv565sjPMSSW6Kt6GYVQtjd3bxKG9k6VqPUmS1dXVdLnDZFSEopwp1TaSxxtejFAw1YqKBzH3+1DPKgdHos1jW9bWFq9cOx8O5+o769vvHF/rLowMN1ud1dPnj81fu3jt2rG99+ws5qPOarvfdzkb2SRTQEW4nOd86SYHbzhhBYhrRaiAGP2ExTkyu0zX4DLZpc31Mjqhm0eyyGGue2mu0Os3rlQiDeem7h5xnfbJhbhvy5uGh6OcpSQFEbw31RKHxfcTRAHYRgMqYKYk1SwzQW72wqWDQ7jn3gPN4tBEtT5UNa3OgmDbYrvQqCf+3PGr507dc+Dg2X71VNbcPtp0Sj5NKUlhWL3YcolQVLk9sgFY0KgqBESUJEazfhzn6tXf/v3fS9bSi2b+S1/a/flH7hwb2xaGdPHi2bnZVycLfnLbtjBX/NihfV+4q8ouVWL2GfdjIiYRUysDwYbltLeaWlOtgRXEiFOjkvbWaj8+fKle+vnPX94zmT+xrdM63mkiRXoS6E9fuLb9oU/9zmefjLvtIXIgygRsABdzEoNI4c3AxA1a0AYYrctjwwxsa5Ia8a3F1uhPj1x84fk3i+FTw3ftegVvZiZfD8bHaKkztPneR7fuvy+J+z5f0CRWUQIUpEkC55VJRW21BkAhBHPboQZgqzUEUCX2kq0uB0PNyp//xX/ff7+JcpVabmamjzQaKRYXw/nojtwXH/6FT0yWerNXe//+tBjLhqFCzIj7nDmAiMXUq7e+/wbYwNCVG5QPoMqq/dXlarmw79eeOlWqXF9aaXWzbm53uGNH0sRYtfRAUbtZrzNzNfzaP4x/75vuu//iYIlYAcpicqIgWBqo8PvABj9KFSrkAJXMByLtdu8H3/z27JnXx5rFypYHxnZNnCq/sm28NtzSRnVnq4/4b/96fO4Kj4wMP/Ns/5mvp9YQWaQ9eA+QWthKfaNG7yNIoUyFUK6nqr7C5p8O/9uJEy9+5p6pcuRfOnrs8V99kt6QlfpS1xdrlcl//Oqr9dWdf1RrlZfj5Q+NHPr1N+ZSM5N8MZ+kJKKsnLN24BhvXIHsrWnksMzlgpeYWBH3Pvb4Y3rw6oWrq3u09s65E5tf3X7f+Kdm5o/EYf2733i3205b5Tu/sqx/sOe1Q39erta53j8uy+F8iw3Yi5hiONAqvXH7uSWNCqLIVkuqQkqu294+tCN9zp0/3349bW0aGj2x8tJSc6l5x2clt7mQZ5ML0+WV6MDBiT/7CqxqPyWmwCTUW4MqVKkQmGIZt9zjbwMDQlspq3gITJKeevPVJlq8VNjUo7snhrJLcuRbTyerJx6678OPPmiT/vzBe0a/+pefmdrzRJv/sJPy2Zn9l1q/FYpXUYhwKc9R8YPSCFJVAplaRVWI2XdWS3uGHvv4wwsvHB3f/cRY0Ghs/uHeqftHxg/GrnTwwL7h5qYHP3p/oznksnTLjkdeOdrttHNhg7jXJmIVMdUymRL0Zmi3EkQBso0aVGyQX7hysbt7tVke/t3PfblY20GU7Zma8hplWRbkXBhFU1NDs1cXavXGyHD99NvvrCWbCmVO1SNOQazO21qFUPhfwGAajcFsJBI/feFcUmzvP7hnrTsLGYwVlHngspVIVfyp16+XSoXl651cGKSpOoP8WofIqKamNjBxG/y4nfoAglod6jMxzZnWo7M/Hi4H5vnXVIlVlBQgCFSUoOsjHJHMu2GTgwhUiTVYE+GAfN+uy4fiA8AGtqfUoKrl/Xn00jsuJ24xNZMGgFzz8IAHlZnrRmZTZUKqtCmgrqG6uGVHYAQkSjoUUNuaSn0jYe8FoxsmnLxlRzKck7GQFFS36tXsJU3ELwjllbfkdGveVFkZbOBOp9y0Zjdpx2uJbUZyycsVF4wMvSdtt0ZGAEyl7LWdHE9RJPKqUCdQInhlS5qpJ6QEeIBAE4F2PJY9IoYTigkRkQFiFrdqygXgtmnZreMkBcini92TRygFAPEKcQolEBmCMqAKJWJVhQiUYBjqIVACGUMAiNha0aQw9WBQ2QnVG+Ko9MEjwP+Xpf8DmkcNuMw1PyYAAAAASUVORK5CYII=";

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const nowISO = () => new Date().toISOString();
const fmtDate = (d) => { if (!d) return "—"; const dt = new Date(d + "T00:00:00"); return dt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }); };
const fmtTime = (t) => { if (!t) return ""; const [h, m] = t.split(":"); const hr = parseInt(h); return `${hr > 12 ? hr - 12 : hr || 12}:${m} ${hr >= 12 ? "PM" : "AM"}`; };
const fmtDateTime = (iso) => { if (!iso) return "—"; const d = new Date(iso); return d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }); };
const fmtFull = (iso) => { if (!iso) return "—"; const d = new Date(iso); return d.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", second: "2-digit" }); };
const calcHours = (inT, outT) => { if (!inT || !outT) return "0.0"; return ((new Date(outT) - new Date(inT)) / 3600000).toFixed(1); };

const STATUS_COLORS = { open: "#22c55e", full: "#f59e0b", closed: "#8899aa", cancelled: "#ef4444" };
const STATUS_LABELS = { open: "Open", full: "Full", closed: "Closed", cancelled: "Cancelled" };

// ─── EMAIL NOTIFICATION ──────────────────────────────────────────────────────
// Set to true when ready to go live with emails
const EMAIL_ENABLED = false;
// Fire-and-forget: doesn't block UI. Silently fails if edge function not set up.
const sendNotification = async (type, data) => {
  if (!EMAIL_ENABLED) return;
  try {
    const fnUrl = `${SUPABASE_URL}/functions/v1/notify-email`;
    await fetch(fnUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${SUPABASE_ANON_KEY}` },
      body: JSON.stringify({ type, data }),
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
`;

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
                <button className="lo" onClick={handleLogout}>Logout</button>
              </div>
            </div>
            {showPwModal && <ChangePassword onClose={() => setShowPwModal(false)} notify={notify} />}
            <main className="mn">
              {profile.role === "coordinator"
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
  const [reg, setReg] = useState({ name: "", email: "", password: "", confirm: "", level: "EMT", shift: "A", phone: "" });
  const [rErr, setRErr] = useState("");

  const login = async () => {
    setErr(""); setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: pass });
    setBusy(false);
    if (error) { setErr(error.message); return; }
  };

  const register = async () => {
    setRErr(""); setBusy(true);
    const { name, email, password, confirm, level, shift, phone } = reg;
    if (!name || !email || !password || !phone) { setRErr("All fields required."); setBusy(false); return; }
    if (password !== confirm) { setRErr("Passwords do not match."); setBusy(false); return; }
    if (password.length < 6) { setRErr("Min 6 characters."); setBusy(false); return; }
    const { error } = await supabase.auth.signUp({
      email: email.trim(), password,
      options: { data: { name, level, shift, phone, role: "staff" } }
    });
    setBusy(false);
    if (error) { setRErr(error.message); return; }
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
          <div className="fg"><label className="fl">Shift</label><select className="sel" value={reg.shift} onChange={e => setReg(p => ({ ...p, shift: e.target.value }))}><option>A</option><option>B</option><option>C</option></select></div>
        </div>
        <div className="fg"><label className="fl">Phone</label><input className="fi" type="tel" value={reg.phone} onChange={e => setReg(p => ({ ...p, phone: e.target.value }))} /></div>
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
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const [pR, eR, sR, aR, cR, lR] = await Promise.all([
      supabase.from("profiles").select("*").order("name"),
      supabase.from("events").select("*").order("date"),
      supabase.from("signups").select("*"),
      supabase.from("attendance").select("*"),
      supabase.from("cancel_requests").select("*").order("requested_at", { ascending: false }),
      supabase.from("activity_log").select("*").order("created_at", { ascending: false }).limit(200),
    ]);
    if (pR.data) setProfiles(pR.data);
    if (eR.data) setEvents(eR.data);
    if (sR.data) setSignups(sR.data);
    if (aR.data) setAttendance(aR.data);
    if (cR.data) setCancelReqs(cR.data);
    if (lR.data) setActivityLog(lR.data);
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return { profiles, events, signups, attendance, cancelReqs, activityLog, loading, refresh };
}

// ─── EVENT STATUS BADGE ───────────────────────────────────────────────────────
function StatusBadge({ status }) {
  return <span className="sts" style={{ background: `${STATUS_COLORS[status]}22`, color: STATUS_COLORS[status] }}>{STATUS_LABELS[status]}</span>;
}

// ─── COORDINATOR VIEW ─────────────────────────────────────────────────────────
function CoordView({ profile, notify }) {
  const { profiles, events, signups, attendance, cancelReqs, activityLog, loading, refresh } = useData();
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
    if (exists) { notify("Already signed in.", "error"); return; }
    await supabase.from("attendance").insert({ staff_id: staffId, event_id: eventId, sign_in_time: nowISO() });
    const ac = profiles.find(p => p.id === staffId);
    await logActivity("signed_in_staff", "attendance", eventId, { staffName: ac?.name });
    notify("Signed in!"); refresh();
  };
  const coordSignOut = async (staffId, eventId) => {
    const rec = attendance.find(a => a.staff_id === staffId && a.event_id === eventId && !a.sign_out_time);
    if (!rec) return;
    await supabase.from("attendance").update({ sign_out_time: nowISO() }).eq("id", rec.id);
    const ac = profiles.find(p => p.id === staffId);
    await logActivity("signed_out_staff", "attendance", eventId, { staffName: ac?.name });
    notify("Signed out!"); refresh();
  };
  const coordRemoveSignup = async (staffId, eventId) => {
    await supabase.from("signups").delete().match({ staff_id: staffId, event_id: eventId });
    const ac = profiles.find(p => p.id === staffId);
    await logActivity("removed_signup", "signup", eventId, { staffName: ac?.name });
    notify("Signup removed."); refresh();
  };

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
      <button className={`tb${tab === "events" ? " on" : ""}`} onClick={() => setTab("events")}>Events</button>
      <button className={`tb${tab === "staff" ? " on" : ""}`} onClick={() => setTab("staff")}>Staff{pendingAccounts.length > 0 && <span className="nd or">{pendingAccounts.length}</span>}</button>
      <button className={`tb${tab === "att" ? " on" : ""}`} onClick={() => setTab("att")}>Attendance</button>
      <button className={`tb${tab === "cr" ? " on" : ""}`} onClick={() => setTab("cr")}>Cancel Reqs{pendingCR.length > 0 && <span className="nd or">{pendingCR.length}</span>}</button>
      <button className={`tb${tab === "log" ? " on" : ""}`} onClick={() => setTab("log")}>Activity Log</button>
      <button className={`tb${tab === "import" ? " on" : ""}`} onClick={() => setTab("import")}>Import</button>
    </div>

    {/* ── DASHBOARD ── */}
    {tab === "dash" && <>
      <div className="stw">
        <div className="stc"><div className="sv sa">{events.length}</div><div className="svl">Events</div></div>
        <div className="stc"><div className="sv sg">{profiles.filter(p => p.approved && p.role === "staff").length}</div><div className="svl">Active Staff</div></div>
        <div className="stc"><div className="sv so">{pendingAccounts.length}</div><div className="svl">Pending</div></div>
        <div className="stc"><div className="sv sy">{signups.filter(s => s.status === "confirmed").length}</div><div className="svl">Signups</div></div>
        <div className="stc"><div className="sv sg">{attendance.filter(a => a.sign_out_time).reduce((s, a) => s + (parseFloat(calcHours(a.sign_in_time, a.sign_out_time)) || 0), 0).toFixed(0)}</div><div className="svl">Total Hrs</div></div>
      </div>

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
                  <div className="evm">{fmtDate(ev.date)} · {fmtTime(ev.time_start)} – {fmtTime(ev.time_end)}</div>
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
                  <div className="dv" /><div className="sct">Signed-Up Staff</div>
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
                          {!at2 && <button className="bt bts bta" onClick={() => coordSignIn(s.staff_id, ev.id)}>In</button>}
                          {at2 && !at2.sign_out_time && <button className="bt bts btg" onClick={() => coordSignOut(s.staff_id, ev.id)}>Out</button>}
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
        <thead><tr><th>Name</th><th>Email</th><th>Level</th><th>Shift</th><th>Phone</th><th>Role</th><th>Actions</th></tr></thead>
        <tbody>{profiles.filter(a => a.approved).map(a => (
          <tr key={a.id}>
            <td style={{ fontWeight: 500 }}>{a.name}</td>
            <td style={{ color: "var(--t2)" }}>{a.email}</td>
            <td>{a.level || "—"}</td>
            <td>{a.shift || "—"}</td>
            <td style={{ color: "var(--t2)" }}>{a.phone || "—"}</td>
            <td><span className={`rb${a.role === "coordinator" ? " co" : ""}`}>{a.role}</span></td>
            <td>{a.role === "staff"
              ? <button className="promo-btn" onClick={() => promoteToCoordinator(a.id)}>Promote</button>
              : a.id !== profile.id
                ? <button className="demote-btn" onClick={() => demoteToStaff(a.id)}>Demote</button>
                : <span style={{ color: "var(--t2)", fontSize: 10 }}>You</span>
            }</td>
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
        <thead><tr><th>Staff</th><th>Event</th><th>In</th><th>Out</th><th>Hrs</th></tr></thead>
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
  </>);
}

// ─── STAFF VIEW ───────────────────────────────────────────────────────────────
function StaffView({ profile, notify }) {
  const { profiles, events, signups, attendance, cancelReqs, loading, refresh } = useData();
  const [tab, setTab] = useState("events");

  const mySignups = signups.filter(s => s.staff_id === profile.id && s.status === "confirmed");
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
    if (mySignups.length >= SOFT_LIMIT) { notify(`Soft limit of ${SOFT_LIMIT} events reached.`, "warn"); }
    const { error } = await supabase.from("signups").insert({ staff_id: profile.id, event_id: eventId, status: "confirmed", signed_up_at: nowISO() });
    if (error) { notify(error.message, "error"); return; }
    await logActivity("signed_up", "signup", eventId, { eventName: ev?.name });
    sendNotification("event_signup", { staffName: profile.name, staffLevel: profile.level, eventName: ev?.name, eventDate: fmtDate(ev?.date) });
    notify("Signed up!"); refresh();
  };

  const cancelSignup = async (eventId) => {
    const attRec = myAtt.find(a => a.event_id === eventId && a.sign_in_time);
    const existingCR = myCR.find(c => c.event_id === eventId && c.status === "pending");
    const ev = events.find(e => e.id === eventId);
    if (attRec) {
      if (existingCR) { notify("Cancel request already pending.", "warn"); return; }
      await supabase.from("cancel_requests").insert({ staff_id: profile.id, event_id: eventId, status: "pending", requested_at: nowISO() });
      await logActivity("requested_cancel", "cancel_request", eventId, { eventName: ev?.name });
      sendNotification("cancel_request", { staffName: profile.name, eventName: ev?.name });
      notify("Cancel request sent to coordinator.", "warn");
    } else {
      await supabase.from("signups").delete().match({ staff_id: profile.id, event_id: eventId });
      await logActivity("cancelled_signup", "signup", eventId, { eventName: ev?.name });
      notify("Signup cancelled.");
    }
    refresh();
  };

  const signIn = async (eventId) => {
    if (myAtt.find(a => a.event_id === eventId)) { notify("Already signed in.", "error"); return; }
    await supabase.from("attendance").insert({ staff_id: profile.id, event_id: eventId, sign_in_time: nowISO() });
    const ev = events.find(e => e.id === eventId);
    await logActivity("signed_in", "attendance", eventId, { eventName: ev?.name });
    notify("Signed in!"); refresh();
  };

  const signOut = async (eventId) => {
    const rec = myAtt.find(a => a.event_id === eventId && !a.sign_out_time);
    if (!rec) return;
    await supabase.from("attendance").update({ sign_out_time: nowISO() }).eq("id", rec.id);
    const ev = events.find(e => e.id === eventId);
    await logActivity("signed_out", "attendance", eventId, { eventName: ev?.name });
    notify("Signed out!"); refresh();
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
        <div className="stc"><div className="sv sg">{mySignups.length}</div><div className="svl">Signed Up</div></div>
        <div className="stc"><div className="sv sy">{myTotalHours.toFixed(1)}</div><div className="svl">My Hours</div></div>
      </div>
      {visibleEvents.map(ev => {
        const es = signups.filter(s => s.event_id === ev.id && s.status === "confirmed");
        const pc = es.filter(s => { const p = profiles.find(x => x.id === s.staff_id); return p?.level === "Paramedic"; }).length;
        const ec = es.filter(s => { const p = profiles.find(x => x.id === s.staff_id); return p?.level === "EMT"; }).length;
        const isMine = myEventIds.includes(ev.id);
        const myAttRec = myAtt.find(a => a.event_id === ev.id);
        const canSignUp = ev.status === "open" && !isMine;

        return (
          <div className="evc" key={ev.id} style={isMine ? { borderColor: "var(--a)" } : {}}>
            <div className="evh">
              <div>
                <div className="evn">{ev.name} <StatusBadge status={ev.status} /> {isMine && <span className="bg si" style={{ marginLeft: 4 }}>Signed Up</span>}</div>
                <div className="evm">{fmtDate(ev.date)} · {fmtTime(ev.time_start)} – {fmtTime(ev.time_end)}</div>
                {(ev.venue || ev.location) && <div className="loc">
                  {ev.venue && <span style={{ fontWeight: 500, color: "var(--t)" }}>{ev.venue}</span>}
                  {ev.venue && ev.location && " · "}
                  {ev.location && <a href={`https://maps.google.com/?q=${encodeURIComponent(ev.location)}`} target="_blank" rel="noopener noreferrer">{ev.location}</a>}
                </div>}
              </div>
              <div className="evb">
                {canSignUp && <button className="bt bts bta" onClick={() => signUpForEvent(ev.id)}>Sign Up</button>}
                {isMine && !myAttRec && <button className="bt bts btg" onClick={() => signIn(ev.id)}>Sign In</button>}
                {isMine && myAttRec && !myAttRec.sign_out_time && <button className="bt bts bto" onClick={() => signOut(ev.id)}>Sign Out</button>}
                {isMine && <button className="bt bts btr" onClick={() => cancelSignup(ev.id)}>Cancel</button>}
              </div>
            </div>
            {ev.notes && <div className="nts">📋 {ev.notes}</div>}
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
        return (
          <div className="evc" key={s.id}>
            <div className="evh">
              <div>
                <div className="evn">{ev.name} <StatusBadge status={ev.status} /></div>
                <div className="evm">{fmtDate(ev.date)} · {fmtTime(ev.time_start)} – {fmtTime(ev.time_end)}</div>
                {(ev.venue || ev.location) && <div className="loc">
                  {ev.venue && <span style={{ fontWeight: 500, color: "var(--t)" }}>{ev.venue}</span>}
                  {ev.venue && ev.location && " · "}
                  {ev.location && <a href={`https://maps.google.com/?q=${encodeURIComponent(ev.location)}`} target="_blank" rel="noopener noreferrer">{ev.location}</a>}
                </div>}
              </div>
              <div className="evb">
                {!myAttRec && <button className="bt bts btg" onClick={() => signIn(ev.id)}>Sign In</button>}
                {myAttRec && !myAttRec.sign_out_time && <button className="bt bts bto" onClick={() => signOut(ev.id)}>Sign Out</button>}
                <button className="bt bts btr" onClick={() => cancelSignup(ev.id)}>Cancel</button>
              </div>
            </div>
            {ev.notes && <div className="nts">📋 {ev.notes}</div>}
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
        <thead><tr><th>Event</th><th>Date</th><th>In</th><th>Out</th><th>Hrs</th></tr></thead>
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
