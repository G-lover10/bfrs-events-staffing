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
  { name: "Staff: All Events / Dashboard tab", pattern: '{/* ── ALL EVENTS ── */}' },
  { name: "Staff: My Events tab", pattern: 'setTab("my")' },
  { name: "Staff: My Hours tab", pattern: 'setTab("hours")' },
  { name: "Staff: My Profile tab", pattern: 'setTab("profile")' },
  { name: "Staff: Cancel Reqs tab", pattern: 'setTab("cr")' },
  { name: "Profile: Availability checkbox", pattern: 'id="avail-cb"' },
  { name: "Profile: Note to coordinator save", pattern: 'avail_note' },
  { name: "Coord: Dashboard tab", pattern: 'setTab("dash")' },
  { name: "Coord: Events tab", pattern: 'tab === "events"' },
  { name: "Coord: Staff tab", pattern: 'tab === "staff"' },
  { name: "Coord: Attendance tab", pattern: 'tab === "att"' },
  { name: "Coord: Activity Log tab", pattern: 'tab === "log"' },
  { name: "Coord: Health tab", pattern: 'tab === "health"' },
  { name: "Coord: Import tab", pattern: 'tab === "import"' },
  { name: "Coord: Feedback tab", pattern: 'tab === "fb"' },
  { name: "Coord: Manually-add-staff handler", pattern: "manuallyAddStaff" },
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
  { name: "Excel import dedup (name+date key)", pattern: "existingKeys.has(key)" },
  { name: "Conflict detection: findConflicts", pattern: "findConflicts" },
  { name: "Conflict detection: findAllOverlaps", pattern: "findAllOverlaps" },
  { name: "Hard block on overlap at approval", pattern: "Hard block — cannot approve" },
  { name: "Send-email Netlify function call", pattern: "/.netlify/functions/send-email" },
  { name: "Withdrawal approve handler (approveCR)", pattern: "approveCR" },
  { name: "Withdrawal deny handler (denyCR)", pattern: "denyCR" },
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

console.log("");
if (failed > 0) {
  console.error(`❌ ${failed} of ${checks.length} preflight checks failed. Build aborted.`);
  process.exit(1);
}
console.log(`✅ All ${passed} preflight checks passed.`);
