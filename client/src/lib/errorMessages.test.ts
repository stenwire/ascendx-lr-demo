import { describe, expect, it } from "vitest";
import { ApiError } from "../api/client";
import { toUserMessage } from "./errorMessages";

describe("toUserMessage", () => {
  it("maps a known code to guidance rather than a status line", () => {
    const message = toUserMessage(new ApiError("Forbidden", "forbidden", 403));
    expect(message).toContain("permission");
    expect(message).not.toMatch(/status \d+/i);
  });

  it("keeps the server's validation copy, which names the field", () => {
    const message = toUserMessage(new ApiError("endDate cannot be before startDate.", "invalid_input", 400, "endDate"));
    expect(message).toBe("endDate cannot be before startDate.");
  });

  it("explains a missing demo team in terms of the fix", () => {
    const message = toUserMessage(new ApiError("…", "demo_team_missing", 409));
    expect(message).toContain("Seed the database");
  });

  it("falls back to the HTTP status when the code is unrecognised", () => {
    const message = toUserMessage(new ApiError("Boom", "some_new_code", 503));
    expect(message).toContain("temporarily unavailable");
  });

  it("gives a 404 something actionable instead of the raw status", () => {
    // This is what a missing dev proxy entry produced.
    const message = toUserMessage(new ApiError("Request failed with status 404.", "invalid_response", 404));
    expect(message).not.toBe("Request failed with status 404.");
    expect(message.length).toBeGreaterThan(20);
  });

  it("treats a network-level failure as unreachable, not as a server error", () => {
    expect(toUserMessage(new TypeError("Failed to fetch"))).toContain("Couldn't reach the server");
  });

  it("never leaks a bare status string for any mapped code", () => {
    const codes = ["unauthenticated", "forbidden", "not_found", "internal_error", "invalid_response"];
    for (const code of codes) {
      const message = toUserMessage(new ApiError("Request failed with status 500.", code, 500));
      expect(message, code).not.toMatch(/^Request failed with status/);
    }
  });

  it("handles something that isn't an Error at all", () => {
    expect(toUserMessage("a string")).toBeTruthy();
    expect(toUserMessage(undefined)).toBeTruthy();
  });
});
