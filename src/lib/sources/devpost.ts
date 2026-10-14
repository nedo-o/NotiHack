import { z } from "zod";
import { parseDateRange } from "../dates";
import type { Hackathon, RegistrationStatus, SourceReader } from "../types";

// Devpost's public listing endpoint (the one its own hackathon search page uses).
const API = "https://devpost.com/api/hackathons";
const MAX_PAGES = 40;

const DevpostHackathon = z.object({
  id: z.union([z.number(), z.string()]),
  title: z.string(),
  url: z.string(),
  thumbnail_url: z.string().nullish(),
  displayed_location: z.object({ icon: z.string().nullish(), location: z.string().nullish() }).nullish(),
  open_state: z.string().nullish(),
  submission_period_dates: z.string().nullish(),
  themes: z.array(z.object({ name: z.string() })).nullish(),
  prize_amount: z.string().nullish(),
  registrations_count: z.number().nullish(),
  organization_name: z.string().nullish(),
  invite_only: z.boolean().nullish(),
});

const DevpostPage = z.object({
  hackathons: z.array(z.unknown()),
  meta: z.object({ total_count: z.number().nullish(), per_page: z.number().nullish() }).nullish(),
});

function status(openState: string | null | undefined): RegistrationStatus {
  if (openState === "open") return "open";
  if (openState === "upcoming") return "announced";
  return "closed";
}

function stripHtml(value: string | null | undefined): string | null {
  if (!value) return null;
  const text = value.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
  return text || null;
}

export function mapDevpost(raw: unknown): Hackathon | null {
  const parsed = DevpostHackathon.safeParse(raw);
  if (!parsed.success) return null;
  const h = parsed.data;
  if (h.invite_only) return null;

  const location = h.displayed_location?.location?.trim() || null;
  const isOnline = h.displayed_location?.icon === "globe" || /^online$/i.test(location ?? "");
  const { start, end } = parseDateRange(h.submission_period_dates);

  return {
    source: "devpost",
    sourceId: String(h.id),
    title: h.title.trim(),
    url: h.url,
    startsOn: start,
    endsOn: end,
    registrationStatus: status(h.open_state),
    isOnline,
    locationText: isOnline ? null : location,
    lat: null,
    lng: null,
    themes: (h.themes ?? []).map((t) => t.name),
    prizeText: stripHtml(h.prize_amount),
    registrationsCount: h.registrations_count ?? null,
    organizer: h.organization_name ?? null,
    imageUrl: h.thumbnail_url ? (h.thumbnail_url.startsWith("//") ? `https:${h.thumbnail_url}` : h.thumbnail_url) : null,
    description: null,
  };
}

export const devpost: SourceReader = {
  name: "devpost",
  async read(fetchFn = fetch) {
    const out: Hackathon[] = [];
    for (let page = 1; page <= MAX_PAGES; page++) {
      const url = `${API}?page=${page}&status[]=upcoming&status[]=open`;
      const res = await fetchFn(url, { headers: { accept: "application/json" } });
      if (!res.ok) throw new Error(`devpost page ${page}: HTTP ${res.status}`);
      const body = DevpostPage.parse(await res.json());
      for (const raw of body.hackathons) {
        const h = mapDevpost(raw);
        if (h) out.push(h);
      }
      const perPage = body.meta?.per_page ?? body.hackathons.length;
      const total = body.meta?.total_count ?? 0;
      if (body.hackathons.length === 0 || page * perPage >= total) break;
    }
    return out;
  },
};
