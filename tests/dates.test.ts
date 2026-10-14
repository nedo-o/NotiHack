import { describe, expect, it } from "vitest";
import { parseDateRange, toIsoDate } from "../src/lib/dates";

describe("parseDateRange", () => {
  it.each([
    ["Oct 10 - Nov 15, 2026", "2026-10-10", "2026-11-15"],
    ["Oct 10 - 12, 2026", "2026-10-10", "2026-10-12"],
    ["Dec 28, 2026 - Jan 03, 2027", "2026-12-28", "2027-01-03"],
    ["Dec 28 - Jan 03, 2027", "2026-12-28", "2027-01-03"],
    ["Sept 5 - 7, 2026", "2026-09-05", "2026-09-07"],
    ["Oct 10, 2026", "2026-10-10", "2026-10-10"],
  ])("%s", (text, start, end) => {
    expect(parseDateRange(text)).toEqual({ start, end });
  });

  it("returns nulls for text it can't read", () => {
    expect(parseDateRange("Ongoing")).toEqual({ start: null, end: null });
    expect(parseDateRange(null)).toEqual({ start: null, end: null });
  });
});

describe("toIsoDate", () => {
  it("keeps the date part", () => {
    expect(toIsoDate("2026-11-21T09:00:00+01:00")).toBe("2026-11-21");
    expect(toIsoDate("Nov 21")).toBeNull();
  });
});
