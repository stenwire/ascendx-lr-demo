import { describe, expect, it, vi } from "vitest";
import { AiProviderError, mapProviderError, withRetry, withTimeout } from "../src/services/ai/errors.js";

describe("mapProviderError", () => {
  it("maps a 429 to upstream_quota_exceeded, retryable", () => {
    const mapped = mapProviderError({ status: 429, message: "rate limited" });
    expect(mapped.code).toBe("upstream_quota_exceeded");
    expect(mapped.retryable).toBe(true);
  });

  it("maps 5xx to upstream_unavailable, retryable", () => {
    for (const status of [500, 502, 503, 504]) {
      const mapped = mapProviderError({ status });
      expect(mapped.code).toBe("upstream_unavailable");
      expect(mapped.retryable).toBe(true);
    }
  });

  it("maps a timeout (AbortError) to timeout, retryable", () => {
    const err = new Error("aborted");
    err.name = "AbortError";
    const mapped = mapProviderError(err);
    expect(mapped.code).toBe("timeout");
    expect(mapped.retryable).toBe(true);
  });

  it("maps a content-safety block to content_blocked, not retryable", () => {
    const mapped = mapProviderError(new Error("Response blocked by safety filter"));
    expect(mapped.code).toBe("content_blocked");
    expect(mapped.retryable).toBe(false);
  });

  it("maps a deterministic 4xx to service_error, not retryable", () => {
    const mapped = mapProviderError({ status: 400, message: "bad request" });
    expect(mapped.code).toBe("service_error");
    expect(mapped.retryable).toBe(false);
  });

  it("maps an unrecognized error to unknown_error, not retryable", () => {
    const mapped = mapProviderError(new Error("something weird"));
    expect(mapped.code).toBe("unknown_error");
    expect(mapped.retryable).toBe(false);
  });

  it("passes an already-mapped AiProviderError through unchanged", () => {
    const original = new AiProviderError("timeout", 504, true);
    expect(mapProviderError(original)).toBe(original);
  });
});

describe("withRetry", () => {
  it("returns the result on first success without retrying", async () => {
    const fn = vi.fn().mockResolvedValue("ok");
    const result = await withRetry(fn);
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries a retryable error and succeeds on the second attempt", async () => {
    const fn = vi.fn().mockRejectedValueOnce({ status: 503 }).mockResolvedValueOnce("recovered");
    const result = await withRetry(fn, 2);
    expect(result).toBe("recovered");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("does not retry a non-retryable error", async () => {
    const fn = vi.fn().mockRejectedValue({ status: 400 });
    await expect(withRetry(fn, 3)).rejects.toMatchObject({ code: "service_error" });
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("stops after maxAttempts even if still retryable", async () => {
    const fn = vi.fn().mockRejectedValue({ status: 503 });
    await expect(withRetry(fn, 2)).rejects.toMatchObject({ code: "upstream_unavailable" });
    expect(fn).toHaveBeenCalledTimes(2);
  });
});

describe("withTimeout", () => {
  it("resolves normally when the call finishes before the deadline", async () => {
    const result = await withTimeout(() => Promise.resolve("fast"), 50);
    expect(result).toBe("fast");
  });

  it("rejects with a retryable timeout error when the call hangs past the deadline", async () => {
    const hang = () => new Promise<string>(() => {}); // never resolves
    await expect(withTimeout(hang, 20)).rejects.toMatchObject({ code: "timeout", retryable: true });
  });
});
