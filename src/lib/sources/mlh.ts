import type { SourceReader } from "../types";
import { extractEvents, toHackathons } from "./schemaorg";

/** MLH seasons run from summer to summer, e.g. the "2027" season starts mid-2026. */
export function mlhSeason(now = new Date()): number {
  return now.getUTCMonth() >= 6 ? now.getUTCFullYear() + 1 : now.getUTCFullYear();
}

const HOSTS = ["https://www.mlh.com", "https://mlh.io"];

export const mlh: SourceReader = {
  name: "mlh",
  async read(fetchFn = fetch) {
    const season = mlhSeason();
    const errors: string[] = [];
    for (const host of HOSTS) {
      const url = `${host}/seasons/${season}/events`;
      const res = await fetchFn(url, { headers: { accept: "text/html" } });
      if (!res.ok) {
        errors.push(`${url}: HTTP ${res.status}`);
        continue;
      }
      const events = extractEvents(await res.text(), res.url || url);
      const today = new Date().toISOString().slice(0, 10);
      return toHackathons("mlh", events, url).filter((h) => !h.endsOn || h.endsOn >= today);
    }
    throw new Error(`mlh: ${errors.join("; ")}`);
  },
};
