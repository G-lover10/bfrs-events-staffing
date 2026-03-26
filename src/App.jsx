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
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = window.XLSX.utils.sheet_to_json(sheet, { defval: "" });
  const events = []; const errors = [];
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
      const d = new Date((date - 25569) * 86400 * 1000);
      fDate = d.toISOString().split("T")[0];
    }
    events.push({ name, date: fDate, time_start: timeStart || "00:00", time_end: timeEnd || "23:59",
      location, venue, notes, status: "open", needed_paramedics: np || 0, needed_emts: ne || 0 });
  });
  return { events, errors };
};

// ─── CSS ──────────────────────────────────────────────────────────────────────
const css = `
@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@400;500;600;700&family=DM+Mono:wght@400;500&display=swap');
*{margin:0;padding:0;box-sizing:border-box}
:root{--bg:#0a0e14;--s:#111820;--s2:#182030;--bd:#1e2a3a;--t:#e8edf3;--t2:#8899aa;--a:#00d4ff;--a2:#0099cc;--g:#22c55e;--r:#ef4444;--o:#f59e0b;--y:#ffd166;--p:#a78bfa}
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
`;

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function App() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notif, setNotif] = useState(null);
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
          <Auth onLogin={(s, p) => { setSession(s); setProfile(p); }} notify={notify} />
        ) : !profile.approved ? (
          <PendingScreen onLogout={handleLogout} />
        ) : (
          <>
            <div className="hdr">
              <div className="hdr-l"><div className="brand">BFRS <span>Events</span></div><span className="beta">BETA {APP_VERSION}</span></div>
              <div className="hdr-r">
                <div className="pill">{profile.name}<span className={`rb${profile.role === "coordinator" ? " co" : ""}`}>{profile.role}</span></div>
                <button className="lo" onClick={handleLogout}>Logout</button>
              </div>
            </div>
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
function PendingScreen({ onLogout }) {
  return (
    <div className="lw"><div className="lc">
      <div className="ll">BFRS Events <span className="beta" style={{ fontSize: 10 }}>BETA {APP_VERSION}</span></div>
      <div style={{ marginTop: 20 }}>
        <div className="pn"><h3>⏳ Pending Approval</h3><p>Your registration is under review by a coordinator. You'll be able to log in once approved.</p></div>
        <button className="bt bp" style={{ marginTop: 14, width: "100%" }} onClick={onLogout}>Back to Login</button>
      </div>
    </div></div>
  );
}

// ─── AUTH ──────────────────────────────────────────────────────────────────────
function Auth({ onLogin, notify }) {
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
      <div className="ll">BFRS Events <span className="beta" style={{ fontSize: 10 }}>BETA {APP_VERSION}</span></div>
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
  const denyAccount = async (id) => {
    const acc = profiles.find(p => p.id === id);
    await logActivity("denied_account", "profile", id, { name: acc?.name });
    await supabase.from("profiles").delete().eq("id", id);
    notify("Account denied.", "error"); refresh();
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

  // ── Excel import ──
  const handleUpload = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    try {
      const XLSX = await loadSheetJS();
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data);
      const { events: newEvs, errors } = parseExcelToEvents(wb);
      if (newEvs.length > 0) {
        const toInsert = newEvs.map(ev => ({ ...ev, created_by: profile.id }));
        const { error } = await supabase.from("events").insert(toInsert);
        if (error) { notify("Import error: " + error.message, "error"); return; }
        await logActivity("imported_events", "event", "bulk", { count: newEvs.length });
      }
      setUpRes({ count: newEvs.length, errors });
      notify(`${newEvs.length} events imported!`); refresh();
    } catch (err) { notify("Import failed: " + err.message, "error"); }
    e.target.value = "";
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
                <div className="sb"><div className="sl"><span>Para</span><span>{pc}/{ev.needed_paramedics}</span></div><div className="st"><div className={`sf p${pc >= ev.needed_paramedics ? " fu" : ""}`} style={{ width: `${Math.min(100, (pc / (ev.needed_paramedics || 1)) * 100)}%` }} /></div></div>
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
        <div className="sct" style={{ color: "var(--y)" }}>Pending Approval</div>
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
          <tr key={a.id}><td style={{ fontWeight: 500 }}>{a.name}</td><td style={{ color: "var(--t2)" }}>{a.email}</td><td>{a.level || "—"}</td><td>{a.shift || "—"}</td><td style={{ color: "var(--t2)" }}>{a.phone || "—"}</td><td><span className={`rb${a.role === "coordinator" ? " co" : ""}`}>{a.role}</span></td></tr>
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
        {upRes && (<div style={{ marginTop: 12 }}>
          <div style={{ color: "var(--g)", fontSize: 13, fontWeight: 600 }}>{upRes.count} events imported</div>
          {upRes.errors.length > 0 && <div style={{ color: "var(--o)", fontSize: 11, marginTop: 4 }}>{upRes.errors.join("; ")}</div>}
        </div>)}
      </div>
      <div className="af">
        <div className="sct">Expected Columns</div>
        <div style={{ fontSize: 11, color: "var(--t2)", fontFamily: "'DM Mono', monospace", lineHeight: 1.8 }}>
          Event Name*, Date*, Start Time, End Time, Location, Venue, Notes, Paramedics Needed, EMTs Needed
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
              <div className="sb"><div className="sl"><span>Para</span><span>{pc}/{ev.needed_paramedics}</span></div><div className="st"><div className={`sf p${pc >= ev.needed_paramedics ? " fu" : ""}`} style={{ width: `${Math.min(100, (pc / (ev.needed_paramedics || 1)) * 100)}%` }} /></div></div>
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
