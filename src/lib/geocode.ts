/**
 * Location text -> coordinates via OpenStreetMap Nominatim.
 * Usage policy: at most 1 request per second, identifying User-Agent, cache results.
 * https://operations.osmfoundation.org/policies/nominatim/
 */

export type Coords = { lat: number; lng: number } | null;

export interface GeocodeCache {
  get(query: string): Promise<Coords | undefined>;
  set(query: string, coords: Coords): Promise<void>;
}

export function memoryCache(): GeocodeCache {
  const map = new Map<string, Coords>();
  return {
    async get(q) {
      return map.has(q) ? map.get(q)! : undefined;
    },
    async set(q, c) {
      map.set(q, c);
    },
  };
}

const USER_AGENT = "NotiHack/0.1 (+https://github.com/nedo-o/notihack)";

export function normalizeQuery(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

export function createGeocoder(cache: GeocodeCache, fetchFn: typeof fetch = fetch, delayMs = 1100) {
  let last = 0;
  return async function geocode(text: string): Promise<Coords> {
    const query = normalizeQuery(text);
    if (!query) return null;
    const cached = await cache.get(query);
    if (cached !== undefined) return cached;

    const wait = last + delayMs - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    last = Date.now();

    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`;
    const res = await fetchFn(url, { headers: { "user-agent": USER_AGENT, accept: "application/json" } });
    if (!res.ok) return null; // don't cache failures, retry next run
    const rows = (await res.json()) as { lat: string; lon: string }[];
    const coords = rows[0] ? { lat: Number(rows[0].lat), lng: Number(rows[0].lon) } : null;
    await cache.set(query, coords);
    return coords;
  };
}
