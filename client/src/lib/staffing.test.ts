import { describe, expect, it } from "vitest";
import { ALEX, BO, CASEY, makeRequest } from "../test/fixtures";
import { parseDateKey } from "./dates";
import { computeCoverage, minRequiredAvailable, windowSpan } from "./staffing";

const WINDOW_START = parseDateKey("2026-09-10");

describe("minRequiredAvailable", () => {
  it("rounds up, matching the server's Math.ceil rule", () => {
    expect(minRequiredAvailable(4)).toBe(2);
    expect(minRequiredAvailable(3)).toBe(2);
    expect(minRequiredAvailable(1)).toBe(1);
  });
});

describe("computeCoverage", () => {
  it("reports a full team when nobody is away", () => {
    const coverage = computeCoverage([], 4, WINDOW_START, 3);
    expect(coverage).toHaveLength(3);
    expect(coverage.every((d) => d.available === 4 && !d.understaffed)).toBe(true);
  });

  it("counts only approved leave — pending does not reduce cover", () => {
    const pending = makeRequest({
      employeeId: ALEX.id,
      status: "pending",
      startDate: "2026-09-10T00:00:00.000Z",
      endDate: "2026-09-10T00:00:00.000Z",
    });
    const [day] = computeCoverage([pending], 4, WINDOW_START, 1);
    expect(day.onLeave).toBe(0);
    expect(day.available).toBe(4);
  });

  it("ignores rejected leave", () => {
    const rejected = makeRequest({
      employeeId: ALEX.id,
      status: "rejected",
      startDate: "2026-09-10T00:00:00.000Z",
      endDate: "2026-09-10T00:00:00.000Z",
    });
    expect(computeCoverage([rejected], 4, WINDOW_START, 1)[0].available).toBe(4);
  });

  it("counts a person once even with two overlapping approved requests", () => {
    const requests = [
      makeRequest({
        id: "a",
        employeeId: ALEX.id,
        status: "approved",
        startDate: "2026-09-10T00:00:00.000Z",
        endDate: "2026-09-11T00:00:00.000Z",
      }),
      makeRequest({
        id: "b",
        employeeId: ALEX.id,
        status: "approved",
        startDate: "2026-09-10T00:00:00.000Z",
        endDate: "2026-09-12T00:00:00.000Z",
      }),
    ];
    expect(computeCoverage(requests, 4, WINDOW_START, 1)[0].onLeave).toBe(1);
  });

  it("flags the days where cover falls below the minimum", () => {
    // Team of 4 needs 2 available. Three away on day one leaves 1.
    const away = [ALEX, BO, CASEY].map((e, i) =>
      makeRequest({
        id: `r${i}`,
        employeeId: e.id,
        status: "approved",
        startDate: "2026-09-10T00:00:00.000Z",
        endDate: "2026-09-10T00:00:00.000Z",
      }),
    );
    const [dayOne, dayTwo] = computeCoverage(away, 4, WINDOW_START, 2);

    expect(dayOne.available).toBe(1);
    expect(dayOne.understaffed).toBe(true);
    expect(dayTwo.available).toBe(4);
    expect(dayTwo.understaffed).toBe(false);
  });

  it("includes both endpoints of a leave range", () => {
    const request = makeRequest({
      employeeId: ALEX.id,
      status: "approved",
      startDate: "2026-09-10T00:00:00.000Z",
      endDate: "2026-09-12T00:00:00.000Z",
    });
    const coverage = computeCoverage([request], 4, WINDOW_START, 4);
    expect(coverage.map((d) => d.onLeave)).toEqual([1, 1, 1, 0]);
  });
});

describe("windowSpan", () => {
  const inWindow = (start: string, end: string) =>
    windowSpan(
      makeRequest({ startDate: `${start}T00:00:00.000Z`, endDate: `${end}T00:00:00.000Z` }),
      WINDOW_START,
      30,
    );

  it("places a request that sits inside the window", () => {
    expect(inWindow("2026-09-12", "2026-09-14")).toEqual({ startOffset: 2, span: 3 });
  });

  it("spans one column for a single-day request", () => {
    expect(inWindow("2026-09-10", "2026-09-10")).toEqual({ startOffset: 0, span: 1 });
  });

  it("clamps a request that starts before the window", () => {
    expect(inWindow("2026-09-05", "2026-09-11")).toEqual({ startOffset: 0, span: 2 });
  });

  it("clamps a request that runs past the window end", () => {
    // Window covers 10 Sep – 9 Oct (30 days).
    expect(inWindow("2026-10-08", "2026-10-20")).toEqual({ startOffset: 28, span: 2 });
  });

  it("returns null for a request entirely before the window", () => {
    expect(inWindow("2026-09-01", "2026-09-05")).toBeNull();
  });

  it("returns null for a request entirely after the window", () => {
    expect(inWindow("2026-11-01", "2026-11-05")).toBeNull();
  });
});
