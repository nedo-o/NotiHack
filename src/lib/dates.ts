const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

function iso(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * Parses Devpost-style date ranges:
 *   "Oct 10 - Nov 15, 2026", "Oct 10 - 12, 2026", "Dec 28, 2026 - Jan 03, 2027", "Oct 10, 2026".
 */
export function parseDateRange(text: string | null | undefined): { start: string | null; end: string | null } {
  if (!text) return { start: null, end: null };
  const clean = text.replace(/\s+/g, " ").trim();
  const [left, right] = clean.split(/\s[-–]\s/);

  const full = /^([A-Za-z]{3})[a-z]*\.? (\d{1,2})(?:, (\d{4}))?$/;
  const dayOnly = /^(\d{1,2})(?:, (\d{4}))?$/;

  const l = left?.match(full);
  if (!l) return { start: null, end: null };
  const lMonth = MONTHS[l[1].toLowerCase()];
  if (!lMonth) return { start: null, end: null };

  if (!right) {
    if (!l[3]) return { start: null, end: null };
    const d = iso(Number(l[3]), lMonth, Number(l[2]));
    return { start: d, end: d };
  }

  let rMonth: number;
  let rDay: number;
  let rYear: number | undefined;
  const r = right.match(full);
  if (r) {
    rMonth = MONTHS[r[1].toLowerCase()];
    rDay = Number(r[2]);
    rYear = r[3] ? Number(r[3]) : undefined;
  } else {
    const rd = right.match(dayOnly);
    if (!rd) return { start: null, end: null };
    rMonth = lMonth;
    rDay = Number(rd[1]);
    rYear = rd[2] ? Number(rd[2]) : undefined;
  }
  if (!rMonth || !rYear) return { start: null, end: null };

  // "Dec 28 - Jan 03, 2027": the start year is the year before.
  const lYear = l[3] ? Number(l[3]) : lMonth > rMonth ? rYear - 1 : rYear;
  return { start: iso(lYear, lMonth, Number(l[2])), end: iso(rYear, rMonth, rDay) };
}

/** Takes the date part of an ISO date or datetime string. */
export function toIsoDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const m = value.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : null;
}
