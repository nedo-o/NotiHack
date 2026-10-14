import { describe, expect, it } from "vitest";
import { devpost, mapDevpost } from "../src/lib/sources/devpost";

// Shape of one item from https://devpost.com/api/hackathons (trimmed).
const inPerson = {
  id: 24001,
  title: "HackaTUM 2026",
  url: "https://hackatum-2026.devpost.com/",
  thumbnail_url: "//d112y698adiu2z.cloudfront.net/photos/hackatum.png",
  displayed_location: { icon: "map-marker-alt", location: "Munich, Germany" },
  open_state: "open",
  submission_period_dates: "Nov 20 - 22, 2026",
  themes: [{ id: 1, name: "Machine Learning/AI" }, { id: 2, name: "Social Good" }],
  prize_amount: "$<span data-currency-value>10,000</span>",
  registrations_count: 812,
  organization_name: "TUM.ai",
  invite_only: false,
};

const online = {
  ...inPerson,
  id: 24002,
  title: "Global AI Jam",
  displayed_location: { icon: "globe", location: "Online" },
  open_state: "upcoming",
};

describe("mapDevpost", () => {
  it("maps an in-person hackathon", () => {
    expect(mapDevpost(inPerson)).toMatchObject({
      source: "devpost",
      sourceId: "24001",
      title: "HackaTUM 2026",
      startsOn: "2026-11-20",
      endsOn: "2026-11-22",
      registrationStatus: "open",
      isOnline: false,
      locationText: "Munich, Germany",
      themes: ["Machine Learning/AI", "Social Good"],
      prizeText: "$10,000",
      registrationsCount: 812,
      imageUrl: "https://d112y698adiu2z.cloudfront.net/photos/hackatum.png",
    });
  });

  it("maps an online hackathon and 'upcoming' to announced", () => {
    expect(mapDevpost(online)).toMatchObject({ isOnline: true, locationText: null, registrationStatus: "announced" });
  });

  it("skips invite-only hackathons and malformed items", () => {
    expect(mapDevpost({ ...inPerson, invite_only: true })).toBeNull();
    expect(mapDevpost({ title: "no id" })).toBeNull();
  });
});

describe("devpost.read", () => {
  it("pages until total_count is reached", async () => {
    const pages = [
      { hackathons: [inPerson], meta: { total_count: 2, per_page: 1 } },
      { hackathons: [online], meta: { total_count: 2, per_page: 1 } },
    ];
    const urls: string[] = [];
    const fakeFetch = (async (url: string) => {
      urls.push(url);
      return new Response(JSON.stringify(pages[urls.length - 1]));
    }) as typeof fetch;

    const result = await devpost.read(fakeFetch);
    expect(result.map((h) => h.title)).toEqual(["HackaTUM 2026", "Global AI Jam"]);
    expect(urls).toHaveLength(2);
  });
});
