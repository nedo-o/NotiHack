/**
 * Reads every source, merges duplicates, geocodes locations and saves the result.
 *
 *   npm run ingest              save to Supabase (needs SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY)
 *   npm run ingest -- --dry-run read and print a summary only, write data/hackathons.json
 *
 * Without Supabase credentials it always behaves like --dry-run.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { createGeocoder, memoryCache } from "../src/lib/geocode";
import { dedupe } from "../src/lib/normalize";
import { devpost } from "../src/lib/sources/devpost";
import { mlh } from "../src/lib/sources/mlh";
import { dbGeocodeCache, saveHackathons, serviceClient } from "../src/lib/store";
import type { Hackathon, SourceReader } from "../src/lib/types";

const SOURCES: SourceReader[] = [devpost, mlh];

/** Sources that must return events, otherwise the run fails so a broken reader is noticed. */
const REQUIRED = new Set(["devpost"]);

/** Cities Nedim is testing with; the summary lists matches for them. */
const WATCH = /münchen|munich|zürich|zurich|milano|milan/i;

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const db = dryRun ? null : serviceClient();
  if (!dryRun && !db) console.log("No Supabase credentials set, running as --dry-run.");

  const all: Hackathon[] = [];
  const failures: string[] = [];
  for (const source of SOURCES) {
    try {
      const found = await source.read();
      console.log(`${source.name}: ${found.length} hackathons`);
      if (found.length === 0 && REQUIRED.has(source.name)) failures.push(`${source.name} returned 0 hackathons`);
      all.push(...found);
    } catch (err) {
      console.error(`${source.name} failed:`, err);
      if (REQUIRED.has(source.name)) failures.push(`${source.name}: ${(err as Error).message}`);
    }
  }

  const merged = dedupe(all);
  const geocode = createGeocoder(db ? dbGeocodeCache(db) : memoryCache());
  // Only geocode what matters for the summary in dry runs, to stay polite to Nominatim.
  for (const h of merged) {
    if (h.isOnline || !h.locationText) continue;
    if (!db && !WATCH.test(h.locationText)) continue;
    const coords = await geocode(h.locationText);
    if (coords) Object.assign(h, coords);
  }

  const byStatus = merged.reduce<Record<string, number>>((acc, h) => {
    acc[h.registrationStatus] = (acc[h.registrationStatus] ?? 0) + 1;
    return acc;
  }, {});
  console.log(`merged: ${merged.length} (${JSON.stringify(byStatus)}), online: ${merged.filter((h) => h.isOnline).length}`);
  const watched = merged.filter((h) => WATCH.test(h.locationText ?? ""));
  console.log(`Munich / Zurich / Milan: ${watched.length}`);
  for (const h of watched) console.log(`  - [${h.registrationStatus}] ${h.title} · ${h.locationText} · ${h.startsOn ?? "?"}`);

  if (db) {
    const res = await saveHackathons(db, merged);
    console.log(`saved: ${res.inserted} new, ${res.updated} updated, ${res.statusChanges} status changes`);
  } else {
    await mkdir("data", { recursive: true });
    await writeFile("data/hackathons.json", JSON.stringify(merged, null, 2));
    console.log("wrote data/hackathons.json");
  }

  if (failures.length) {
    console.error(`FAILED: ${failures.join("; ")}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
