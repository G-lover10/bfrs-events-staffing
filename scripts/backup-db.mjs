// Dumps every Supabase table this app uses to backups/<UTC-timestamp>/<table>.json
// Requires env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
// Run: node scripts/backup-db.mjs

import { createClient } from "@supabase/supabase-js";
import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";

const TABLES = [
  "profiles",
  "events",
  "signups",
  "attendance",
  "cancel_requests",
  "feedback",
  "activity_log",
];

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars.");
  process.exit(1);
}

const sb = createClient(url, key, { auth: { persistSession: false } });

const ts = new Date().toISOString().replace(/[:.]/g, "-").replace("T", "_").slice(0, 19);
const outDir = join("backups", ts);
mkdirSync(outDir, { recursive: true });

const manifest = { takenAt: new Date().toISOString(), tables: {} };
let totalRows = 0;
let hadError = false;

for (const table of TABLES) {
  const rows = [];
  const PAGE = 1000;
  try {
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await sb.from(table).select("*").range(from, from + PAGE - 1);
      if (error) throw error;
      if (!data || data.length === 0) break;
      rows.push(...data);
      if (data.length < PAGE) break;
    }
    writeFileSync(join(outDir, `${table}.json`), JSON.stringify(rows, null, 2));
    manifest.tables[table] = { rows: rows.length, ok: true };
    totalRows += rows.length;
    console.log(`  ${table}: ${rows.length} rows`);
  } catch (e) {
    manifest.tables[table] = { rows: 0, ok: false, error: String(e?.message || e) };
    console.error(`  ${table}: FAILED — ${e?.message || e}`);
    hadError = true;
  }
}

writeFileSync(join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2));
console.log(`\nBackup written to ${outDir}/ (${totalRows} rows across ${TABLES.length} tables)`);
if (hadError) {
  console.error("One or more tables failed — check manifest.json");
  process.exit(2);
}
