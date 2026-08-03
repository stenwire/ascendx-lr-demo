import { describe, expect, it } from "vitest";
import {
  addDays,
  daysBetween,
  formatDateRange,
  formatDay,
  inclusiveDayCount,
  isWeekend,
  parseDateKey,
  toDateKey,
  todayInputValue,
} from "./dates";

describe("toDateKey / parseDateKey", () => {
  it("takes the calendar date out of a full ISO timestamp", () => {
    expect(toDateKey("2026-09-10T00:00:00.000Z")).toBe("2026-09-10");
  });

  it("parses to UTC midnight regardless of the host timezone", () => {
    const date = parseDateKey("2026-09-10T00:00:00.000Z");
    expect(date.getUTCFullYear()).toBe(2026);
    expect(date.getUTCMonth()).toBe(8); // September
    expect(date.getUTCDate()).toBe(10);
    expect(date.getUTCHours()).toBe(0);
  });

  it("does not shift the day for a late-evening UTC timestamp", () => {
    // A naive `new Date(iso).getDate()` would report the 11th east of GMT and
    // the 10th west of it. The date key must stay put.
    expect(toDateKey("2026-09-10T23:30:00.000Z")).toBe("2026-09-10");
    expect(parseDateKey("2026-09-10T23:30:00.000Z").getUTCDate()).toBe(10);
  });
});

describe("inclusiveDayCount", () => {
  it("counts a single-day request as one day", () => {
    expect(inclusiveDayCount("2026-09-10T00:00:00.000Z", "2026-09-10T00:00:00.000Z")).toBe(1);
  });

  it("counts both endpoints", () => {
    expect(inclusiveDayCount("2026-09-10T00:00:00.000Z", "2026-09-14T00:00:00.000Z")).toBe(5);
  });

  it("counts correctly across a month boundary", () => {
    expect(inclusiveDayCount("2026-09-29T00:00:00.000Z", "2026-10-02T00:00:00.000Z")).toBe(4);
  });

  it("counts correctly across a leap day", () => {
    expect(inclusiveDayCount("2028-02-28T00:00:00.000Z", "2028-03-01T00:00:00.000Z")).toBe(3);
  });
});

describe("daysBetween / addDays", () => {
  it("is zero for the same day and survives a DST boundary", () => {
    const day = parseDateKey("2026-03-29");
    expect(daysBetween(day, day)).toBe(0);
    // Europe shifts clocks on 29 March 2026; UTC-based maths must not round to 0 or 2.
    expect(daysBetween(parseDateKey("2026-03-28"), parseDateKey("2026-03-30"))).toBe(2);
  });

  it("adds days without drifting", () => {
    expect(toDateKey(addDays(parseDateKey("2026-09-10"), 5).toISOString())).toBe("2026-09-15");
    expect(toDateKey(addDays(parseDateKey("2026-12-30"), 3).toISOString())).toBe("2027-01-02");
  });
});

describe("formatting", () => {
  it("collapses a single-day range", () => {
    const range = formatDateRange("2026-09-10T00:00:00.000Z", "2026-09-10T00:00:00.000Z");
    expect(range).toContain("10");
    expect(range).toContain("Sep");
    expect(range).not.toContain("–");
  });

  it("shows both ends of a multi-day range", () => {
    const range = formatDateRange("2026-09-10T00:00:00.000Z", "2026-09-14T00:00:00.000Z");
    expect(range).toContain("10");
    expect(range).toContain("14");
    expect(range).toContain("–");
  });

  it("formats a day without shifting it", () => {
    expect(formatDay("2026-09-10T00:00:00.000Z")).toContain("10");
  });
});

describe("isWeekend", () => {
  it("identifies Saturday and Sunday", () => {
    expect(isWeekend(parseDateKey("2026-09-12"))).toBe(true); // Saturday
    expect(isWeekend(parseDateKey("2026-09-13"))).toBe(true); // Sunday
  });

  it("rejects weekdays", () => {
    expect(isWeekend(parseDateKey("2026-09-14"))).toBe(false); // Monday
    expect(isWeekend(parseDateKey("2026-09-11"))).toBe(false); // Friday
  });
});

describe("todayInputValue", () => {
  it("returns a YYYY-MM-DD string usable as an input min", () => {
    expect(todayInputValue()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
