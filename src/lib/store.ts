import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Coords, GeocodeCache } from "./geocode";
import type { Hackathon, RegistrationStatus } from "./types";

export function serviceClient(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

export function dbGeocodeCache(db: SupabaseClient): GeocodeCache {
  return {
    async get(query) {
      const { data, error } = await db.from("geocode_cache").select("lat,lng").eq("query", query).maybeSingle();
      if (error) throw error;
      if (!data) return undefined;
      return data.lat == null ? null : { lat: data.lat, lng: data.lng };
    },
    async set(query, coords: Coords) {
      const { error } = await db
        .from("geocode_cache")
        .upsert({ query, lat: coords?.lat ?? null, lng: coords?.lng ?? null });
      if (error) throw error;
    },
  };
}

type Existing = { id: number; source_id: string; registration_status: RegistrationStatus; status_changed_at: string };

const CHUNK = 200;

function chunks<T>(items: T[]): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += CHUNK) out.push(items.slice(i, i + CHUNK));
  return out;
}

export interface SaveResult {
  inserted: number;
  updated: number;
  statusChanges: number;
}

/** Upserts hackathons and records a status_events row for every new or changed registration status. */
export async function saveHackathons(db: SupabaseClient, hackathons: Hackathon[]): Promise<SaveResult> {
  const result: SaveResult = { inserted: 0, updated: 0, statusChanges: 0 };
  const now = new Date().toISOString();
  const bySource = new Map<string, Hackathon[]>();
  const unique = new Map(hackathons.map((h) => [`${h.source}|${h.sourceId}`, h]));
  for (const h of unique.values()) bySource.set(h.source, [...(bySource.get(h.source) ?? []), h]);

  for (const [source, list] of bySource) {
    for (const part of chunks(list)) {
      const { data: existingRows, error: readError } = await db
        .from("hackathons")
        .select("id,source_id,registration_status,status_changed_at")
        .eq("source", source)
        .in("source_id", part.map((h) => h.sourceId));
      if (readError) throw readError;
      const existing = new Map((existingRows as Existing[]).map((r) => [r.source_id, r]));

      const rows = part.map((h) => {
        const prev = existing.get(h.sourceId);
        const changed = !prev || prev.registration_status !== h.registrationStatus;
        return {
          source: h.source,
          source_id: h.sourceId,
          title: h.title,
          url: h.url,
          starts_on: h.startsOn,
          ends_on: h.endsOn,
          registration_status: h.registrationStatus,
          is_online: h.isOnline,
          location_text: h.locationText,
          lat: h.lat,
          lng: h.lng,
          themes: h.themes,
          prize_text: h.prizeText,
          registrations_count: h.registrationsCount,
          organizer: h.organizer,
          image_url: h.imageUrl,
          description: h.description,
          last_seen_at: now,
          status_changed_at: changed ? now : prev!.status_changed_at,
        };
      });

      const { data: saved, error: writeError } = await db
        .from("hackathons")
        .upsert(rows, { onConflict: "source,source_id" })
        .select("id,source_id,registration_status");
      if (writeError) throw writeError;

      const events = (saved as Omit<Existing, "status_changed_at">[])
        .filter((r) => existing.get(r.source_id)?.registration_status !== r.registration_status)
        .map((r) => ({
          hackathon_id: r.id,
          from_status: existing.get(r.source_id)?.registration_status ?? null,
          to_status: r.registration_status,
        }));
      if (events.length) {
        const { error } = await db.from("status_events").insert(events);
        if (error) throw error;
      }

      result.inserted += part.filter((h) => !existing.has(h.sourceId)).length;
      result.updated += part.filter((h) => existing.has(h.sourceId)).length;
      result.statusChanges += events.length;
    }
  }
  return result;
}
