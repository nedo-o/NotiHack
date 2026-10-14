import { describe, expect, it } from "vitest";
import { createGeocoder, memoryCache } from "../src/lib/geocode";
import { dedupe, titleKey } from "../src/lib/normalize";
import type { Hackathon } from "../src/lib/types";

function hack(partial: Partial<Hackathon>): Hackathon {
  return {
    source: "devpost", sourceId: "1", title: "X", url: "https://x", startsOn: "2026-11-20", endsOn: null,
    registrationStatus: "announced", isOnline: false, locationText: null, lat: null, lng: null, themes: [],
    prizeText: null, registrationsCount: null, organizer: null, imageUrl: null, description: null,
    ...partial,
  };
}

describe("titleKey", () => {
  it("ignores case, accents, punctuation and the year", () => {
    expect(titleKey("HackaTUM 2026!")).toBe(titleKey("hackatum"));
    expect(titleKey("Zürich Hacks")).toBe("zurich hacks");
  });
});

describe("dedupe", () => {
  it("merges the same hackathon from two sources, devpost first", () => {
    const merged = dedupe([
      hack({ source: "mlh", sourceId: "m", title: "HackaTUM", locationText: "Munich", imageUrl: "https://img" }),
      hack({ source: "devpost", sourceId: "d", title: "HackaTUM 2026", registrationStatus: "open", themes: ["AI"] }),
    ]);
    expect(merged).toHaveLength(1);
    expect(merged[0]).toMatchObject({
      source: "devpost", registrationStatus: "open", locationText: "Munich", imageUrl: "https://img", themes: ["AI"],
    });
  });

  it("keeps hackathons with the same name on different dates apart", () => {
    expect(dedupe([hack({ startsOn: "2026-01-01" }), hack({ startsOn: "2027-01-01" })])).toHaveLength(2);
  });
});

describe("geocoder", () => {
  it("caches results, including 'not found'", async () => {
    let calls = 0;
    const fakeFetch = (async (url: string) => {
      calls++;
      const found = url.includes("munich");
      return new Response(JSON.stringify(found ? [{ lat: "48.13", lon: "11.58" }] : []));
    }) as typeof fetch;
    const geocode = createGeocoder(memoryCache(), fakeFetch, 0);

    expect(await geocode("Munich, Germany")).toEqual({ lat: 48.13, lng: 11.58 });
    expect(await geocode("  munich,   germany ")).toEqual({ lat: 48.13, lng: 11.58 });
    expect(await geocode("Nowhere")).toBeNull();
    expect(await geocode("nowhere")).toBeNull();
    expect(calls).toBe(2);
  });
});
