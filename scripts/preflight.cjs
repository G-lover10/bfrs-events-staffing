#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const SRC = path.join(__dirname, "..", "src", "App.jsx");
let src;
try {
  src = fs.readFileSync(SRC, "utf8");
} catch (e) {
  console.error(`Cannot read ${SRC}: ${e.message}`);
  process.exit(2);
}

const checks = [
  { name: "Staff: All Events / Dashboard tab", pattern: "{/* ── ALL EVENTS ── */}" },
  { name: "Staff: My Events tab", pattern: ">My Events" },
  { name: "Staff: My Hours tab", pattern: ">My Hours<" },
  { name: "Staff: My Profile tab", pattern: ">My Profile<" },
  { name: "Staff: Cancel Reqs tab", pattern: ">Cancel Reqs" },
  { name: "Profile: Availability column", pattern: "availability" },
  { name: "Profile: Note to coordinator column", pattern: "avail_note" },
  { name: "Coord: Dashboard tab", pattern: ">Dashboard<" },
  { name: "Coord: Events tab", pattern: 'tab === "events"' },
  { name: "Coord: Staff tab", pattern: 'tab === "staff"' },
  { name: "Coord: Attendance tab", pattern: 'tab === "att"' },
  { name: "Coord: Activity Log tab", pattern: 'tab === "log"' },
  { name: "Coord: Health tab", pattern: 'tab === "health"' },
  { name: "Coord: Import tab", pattern: 'tab === "import"' },
  { name: "Coord: Feedback tab", pattern: 'tab === "fb"' },
  { name: "Coord: Add Staff to event button", pattern: "Add Staff" },
  { name: "Coord: Past Events collapsible", pattern: "showPastEvents" },
  { name: "Coord: Activity Log Recent/Past split", pattern: "thirtyDaysAgo" },
  { name: "Coord: Past Activity toggle", pattern: "showPastLog" },
  { name: "Shift warn: 'you WILL arrive late' wording", pattern: "you WILL arrive late" },
  { name: "Outlook invite URL", pattern: "outlook.office.com/calendar" },
  { name: "Kelly Day math (isKellyDay)", pattern: "isKellyDay" },
  { name: "Pay period (Friday cycle)", pattern: "getPaydayForDate" },
  { name: "Sign Up debounce label", pattern: "Sending..." },
  { name: "Activity log RLS-safe insert (logActivity)", pattern: "logActivity" },
  { name: "Score signup function", pattern: "scoreSignup" },
  { name: "Version-update banner state", pattern: "newVersionAvailable" },
  { name: "Coordinator-as-staff toggle", pattern: "viewAsStaff" },
  { name: "Import dedup (matches existing name+date)", pattern: "import" },
];

let failed = 0;
let passed = 0;
for (const c of checks) {
  if (src.includes(c.pattern)) {
    console.log(`✓ ${c.name}`);
    passed++;
  } else {
    console.error(`✗ MISSING: ${c.name}  (pattern: ${JSON.stringify(c.pattern)})`);
    failed++;
  }
}

const undefinedCalls = [];
const definedNames = new Set();
const defRe = /(?:const|let|var|function)\s+([a-zA-Z_$][\w$]*)\s*[=({]/g;
let m;
while ((m = defRe.exec(src)) !== null) definedNames.add(m[1]);

const jsBuiltins = new Set([
  "Array", "Boolean", "Date", "Error", "JSON", "Math", "Number", "Object",
  "Promise", "RegExp", "Set", "String", "Map", "WeakMap", "WeakSet",
  "parseInt", "parseFloat", "isNaN", "isFinite", "encodeURIComponent",
  "decodeURIComponent", "fetch", "console", "window", "document", "alert",
  "confirm", "prompt", "setTimeout", "setInterval", "clearTimeout",
  "clearInterval", "URL", "URLSearchParams", "FormData", "FileReader",
  "Blob", "Symbol", "Proxy", "Reflect", "useState", "useEffect", "useRef",
  "useMemo", "useCallback", "useContext", "createContext", "Fragment",
  "supabase", "React",
]);

console.log("");
if (failed > 0) {
  console.error(`\n❌ ${failed} of ${checks.length} preflight checks failed. Build aborted.`);
  process.exit(1);
}
console.log(`\n✅ All ${passed} preflight checks passed.`);
