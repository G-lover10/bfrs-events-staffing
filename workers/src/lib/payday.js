// BFRS pay period math — canonical source of truth.
// Mirrors src/App.jsx so frontend + backend never drift.
//
// Reference (Notion: "💰 DESIGN SPEC: Pay Period Hours View"):
//   Apr 18 – May 1 → paid May 15
//   May 2 – May 15 → paid May 29
//   May 16 – May 29 → paid Jun 12
//   ... biweekly
//
// May 1 is the END of a pay period, NOT a payday.
// May 15 is the FIRST real payday Friday.

export const PAYDAY_REF = new Date("2026-05-15T00:00:00Z");
export const PERIOD_END_REF = new Date("2026-05-01T00:00:00Z");

// True if the given YYYY-MM-DD string is a payday Friday.
export function isPaydayFriday(dateStr) {
  if (!dateStr) return false;
  const d = new Date(dateStr + "T00:00:00Z");
  if (d.getUTCDay() !== 5) return false;
  const diffDays = Math.round((d - PAYDAY_REF) / 86400000);
  return diffDays >= 0 && diffDays % 14 === 0;
}

// Returns the payday (YYYY-MM-DD) that the given event date will be paid on.
// payday = period_end + 14 days, where period_end is the period-ending Friday
// on or after the event date.
export function getPaydayForDate(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr + "T00:00:00Z");
  const periodEnd = new Date(PERIOD_END_REF);
  while (periodEnd < d) periodEnd.setUTCDate(periodEnd.getUTCDate() + 14);
  const payday = new Date(periodEnd);
  payday.setUTCDate(payday.getUTCDate() + 14);
  return isoDate(payday);
}

// Returns { start, end, payday, checkLabel, rangeLabel } for the pay period
// containing the given date string.
export function getPayPeriodForDate(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr + "T00:00:00Z");
  const periodEnd = new Date(PERIOD_END_REF);
  while (periodEnd < d) periodEnd.setUTCDate(periodEnd.getUTCDate() + 14);
  const payday = new Date(periodEnd);
  payday.setUTCDate(payday.getUTCDate() + 14);
  const periodStart = new Date(periodEnd);
  periodStart.setUTCDate(periodStart.getUTCDate() - 13);
  const monthsShort = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const sm = monthsShort[periodStart.getUTCMonth()];
  const em = monthsShort[periodEnd.getUTCMonth()];
  const rangeLabel = (sm === em)
    ? `${sm} ${periodStart.getUTCDate()}–${periodEnd.getUTCDate()}`
    : `${sm} ${periodStart.getUTCDate()}–${em} ${periodEnd.getUTCDate()}`;
  const checkLabel = `${monthsShort[payday.getUTCMonth()]} ${payday.getUTCDate()} Check`;
  return {
    start: isoDate(periodStart),
    end: isoDate(periodEnd),
    payday: isoDate(payday),
    checkLabel,
    rangeLabel,
  };
}

function isoDate(dt) {
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const d = String(dt.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
