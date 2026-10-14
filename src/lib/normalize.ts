import type { Hackathon } from "./types";

/** Lower-case, accent-free title without punctuation or a trailing year, for matching. */
export function titleKey(title: string): string {
  return title
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\b20\d\d\b/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function dedupeKey(h: Hackathon): string {
  return `${titleKey(h.title)}|${h.startsOn ?? "?"}`;
}

/** Sources listed first win when the same hackathon shows up more than once. */
const SOURCE_PRIORITY = ["devpost", "mlh"];

function rank(source: string): number {
  const i = SOURCE_PRIORITY.indexOf(source);
  return i === -1 ? SOURCE_PRIORITY.length : i;
}

/**
 * Merges the same hackathon found on several sources. The higher-priority record is kept and
 * its empty fields are filled from the others; "open" from any source wins over "announced".
 */
export function dedupe(hackathons: Hackathon[]): Hackathon[] {
  const byKey = new Map<string, Hackathon>();
  const sorted = [...hackathons].sort((a, b) => rank(a.source) - rank(b.source));
  for (const h of sorted) {
    const key = dedupeKey(h);
    const kept = byKey.get(key);
    if (!kept) {
      byKey.set(key, { ...h });
      continue;
    }
    for (const field of Object.keys(h) as (keyof Hackathon)[]) {
      const current = kept[field];
      if (current == null || (Array.isArray(current) && current.length === 0)) {
        (kept as unknown as Record<string, unknown>)[field] = h[field];
      }
    }
    if (h.registrationStatus === "open") kept.registrationStatus = "open";
  }
  return [...byKey.values()];
}
