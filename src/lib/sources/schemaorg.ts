import * as cheerio from "cheerio";
import { toIsoDate } from "../dates";
import type { Hackathon } from "../types";

/**
 * Many event sites (MLH, Luma, Eventbrite, university pages) describe events with
 * schema.org markup, either as JSON-LD or as HTML microdata. This reads both, so a
 * new source often only needs a URL.
 */

type Json = Record<string, unknown>;

function asArray<T>(v: T | T[] | undefined | null): T[] {
  if (v == null) return [];
  return Array.isArray(v) ? v : [v];
}

function str(v: unknown): string | null {
  if (typeof v === "string") return v.trim() || null;
  if (v && typeof v === "object" && "name" in v) return str((v as Json).name);
  return null;
}

function isEvent(node: Json): boolean {
  return asArray(node["@type"] as string | string[]).some((t) => typeof t === "string" && /Event$|Hackathon/i.test(t));
}

function flatten(node: unknown): Json[] {
  if (Array.isArray(node)) return node.flatMap(flatten);
  if (!node || typeof node !== "object") return [];
  const obj = node as Json;
  return [obj, ...flatten(obj["@graph"]), ...flatten(obj.itemListElement), ...flatten(obj.item)];
}

function locationOf(event: Json): { isOnline: boolean; text: string | null } {
  const mode = String(event.eventAttendanceMode ?? "");
  const locations = asArray(event.location as Json | Json[]);
  const physical = locations.find((l) => l && l["@type"] !== "VirtualLocation");
  const online = /Online/i.test(mode) || (locations.length > 0 && !physical);
  if (!physical) return { isOnline: online, text: null };
  const address = physical.address;
  if (typeof address === "string") return { isOnline: online && !address, text: address.trim() || null };
  const a = (address ?? {}) as Json;
  const parts = [str(a.addressLocality), str(a.addressRegion), str(a.addressCountry)].filter(Boolean);
  const text = parts.length ? parts.join(", ") : str(physical.name);
  return { isOnline: online && !text, text };
}

export interface SchemaEvent {
  title: string;
  url: string | null;
  startsOn: string | null;
  endsOn: string | null;
  isOnline: boolean;
  locationText: string | null;
  imageUrl: string | null;
  description: string | null;
  organizer: string | null;
}

function fromJsonLd($: cheerio.CheerioAPI): SchemaEvent[] {
  const events: SchemaEvent[] = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    let data: unknown;
    try {
      data = JSON.parse($(el).text());
    } catch {
      return;
    }
    for (const node of flatten(data)) {
      if (!isEvent(node)) continue;
      const title = str(node.name);
      if (!title) continue;
      const loc = locationOf(node);
      events.push({
        title,
        url: str(node.url),
        startsOn: toIsoDate(str(node.startDate)),
        endsOn: toIsoDate(str(node.endDate)),
        isOnline: loc.isOnline,
        locationText: loc.text,
        imageUrl: str(asArray(node.image as unknown[])[0]) ?? null,
        description: str(node.description),
        organizer: str(asArray(node.organizer as unknown[])[0]),
      });
    }
  });
  return events;
}

function fromMicrodata($: cheerio.CheerioAPI, baseUrl: string): SchemaEvent[] {
  const events: SchemaEvent[] = [];
  $('[itemtype*="schema.org/Event"], [itemtype*="schema.org/Hackathon"]').each((_, el) => {
    const scope = $(el);
    const prop = (name: string): string | null => {
      const node = scope.find(`[itemprop="${name}"]`).first();
      if (!node.length) return null;
      return (node.attr("content") ?? node.attr("datetime") ?? node.attr("href") ?? node.text()).trim() || null;
    };
    const title = prop("name");
    if (!title) return;
    const href = prop("url") ?? scope.find("a[href]").first().attr("href") ?? null;
    const parts = [prop("addressLocality"), prop("addressRegion"), prop("addressCountry")].filter(Boolean);
    const locationText = parts.length ? parts.join(", ") : null;
    const mode = prop("eventAttendanceMode") ?? "";
    const img = scope.find("img").first().attr("src") ?? null;
    events.push({
      title,
      url: href ? new URL(href, baseUrl).toString() : null,
      startsOn: toIsoDate(prop("startDate")),
      endsOn: toIsoDate(prop("endDate")),
      isOnline: /online/i.test(mode) || /digital|online/i.test(locationText ?? ""),
      locationText: /digital|online/i.test(locationText ?? "") ? null : locationText,
      imageUrl: img ? new URL(img, baseUrl).toString() : null,
      description: null,
      organizer: null,
    });
  });
  return events;
}

export function extractEvents(html: string, baseUrl: string): SchemaEvent[] {
  const $ = cheerio.load(html);
  const jsonLd = fromJsonLd($);
  return jsonLd.length ? jsonLd : fromMicrodata($, baseUrl);
}

/** Turns schema.org events into hackathons for one source. */
export function toHackathons(source: string, events: SchemaEvent[], pageUrl: string): Hackathon[] {
  return events.map((e) => ({
    source,
    sourceId: e.url ?? `${e.title}|${e.startsOn ?? ""}`,
    title: e.title,
    url: e.url ?? pageUrl,
    startsOn: e.startsOn,
    endsOn: e.endsOn,
    // A listing alone doesn't prove registration is open; the status checker decides that.
    registrationStatus: "announced",
    isOnline: e.isOnline,
    locationText: e.locationText,
    lat: null,
    lng: null,
    themes: [],
    prizeText: null,
    registrationsCount: null,
    organizer: e.organizer,
    imageUrl: e.imageUrl,
    description: e.description,
  }));
}
