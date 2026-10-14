import { describe, expect, it } from "vitest";
import { mlhSeason } from "../src/lib/sources/mlh";
import { extractEvents } from "../src/lib/sources/schemaorg";

const jsonLdPage = `
<html><head>
<script type="application/ld+json">
{"@context":"https://schema.org","@graph":[
  {"@type":"Organization","name":"Not an event"},
  {"@type":"Event","name":"HackZurich 2026","url":"https://hackzurich.com",
   "startDate":"2026-09-18T18:00:00+02:00","endDate":"2026-09-20",
   "eventAttendanceMode":"https://schema.org/OfflineEventAttendanceMode",
   "location":{"@type":"Place","name":"Technopark","address":{"@type":"PostalAddress","addressLocality":"Zürich","addressCountry":"CH"}}},
  {"@type":["Event","Hackathon"],"name":"Remote Hack","startDate":"2026-10-01",
   "location":{"@type":"VirtualLocation","url":"https://example.com"}}
]}
</script>
<script type="application/ld+json">{ broken json </script>
</head></html>`;

const microdataPage = `
<div class="event" itemscope itemtype="http://schema.org/Event">
  <a class="event-link" href="/events/polihack" itemprop="url">
    <h3 itemprop="name">PoliHack Milano</h3>
    <meta itemprop="startDate" content="2026-11-07">
    <meta itemprop="endDate" content="2026-11-08">
    <div itemprop="location" itemscope itemtype="http://schema.org/Place">
      <span itemprop="addressLocality">Milan</span>, <span itemprop="addressRegion">IT</span>
    </div>
    <img src="/img/polihack.png">
  </a>
</div>
<div class="event" itemscope itemtype="http://schema.org/Event">
  <h3 itemprop="name">Digital Only Hacks</h3>
  <meta itemprop="startDate" content="2026-12-01">
  <span itemprop="addressLocality">Everywhere</span>, <span itemprop="addressRegion">Digital</span>
</div>`;

describe("extractEvents", () => {
  it("reads JSON-LD events inside @graph and ignores broken blocks", () => {
    const events = extractEvents(jsonLdPage, "https://example.com");
    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({
      title: "HackZurich 2026",
      startsOn: "2026-09-18",
      endsOn: "2026-09-20",
      isOnline: false,
      locationText: "Zürich, CH",
    });
    expect(events[1]).toMatchObject({ title: "Remote Hack", isOnline: true, locationText: null });
  });

  it("falls back to microdata (MLH-style listings)", () => {
    const events = extractEvents(microdataPage, "https://www.mlh.com/seasons/2027/events");
    expect(events[0]).toMatchObject({
      title: "PoliHack Milano",
      url: "https://www.mlh.com/events/polihack",
      startsOn: "2026-11-07",
      locationText: "Milan, IT",
      isOnline: false,
      imageUrl: "https://www.mlh.com/img/polihack.png",
    });
    expect(events[1]).toMatchObject({ isOnline: true, locationText: null });
  });
});

describe("mlhSeason", () => {
  it("switches to next year's season in July", () => {
    expect(mlhSeason(new Date("2026-10-14"))).toBe(2027);
    expect(mlhSeason(new Date("2027-03-01"))).toBe(2027);
  });
});
