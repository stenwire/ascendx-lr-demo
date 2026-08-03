/**
 * Central error_code -> user-facing message table, ported from the pattern in
 * reference_projects/ai_agent_service (main.py's ClientError/ServerError mapping) and
 * estate_manager/ai/api.py's single shared MESSAGES dict: one place owns user-facing copy
 * regardless of which layer detected the failure.
 *
 * None of these ever reach the end user directly for a leave approval — a failure here
 * always degrades to the default templated approval message (see leaveRequestService.ts).
 * The mapping still matters for logs/observability and for surfacing a specific reason
 * on manual AI-message retry.
 */
export type AiErrorCode =
  | "upstream_quota_exceeded"
  | "upstream_unavailable"
  | "service_error"
  | "timeout"
  | "content_blocked"
  | "malformed_response"
  | "guardrail_blocked"
  | "unknown_error";

export const AI_ERROR_MESSAGES: Record<AiErrorCode, string> = {
  upstream_quota_exceeded: "The AI provider is temporarily rate-limited. A default message was used instead.",
  upstream_unavailable: "The AI provider is temporarily unavailable. A default message was used instead.",
  service_error: "The AI provider rejected the request. A default message was used instead.",
  timeout: "The AI provider took too long to respond. A default message was used instead.",
  content_blocked: "The AI provider declined to generate a message for this content. A default message was used instead.",
  malformed_response: "The AI provider returned an unusable response. A default message was used instead.",
  guardrail_blocked: "The request was blocked by a safety guardrail before reaching the AI provider. A default message was used instead.",
  unknown_error: "The AI message could not be generated. A default message was used instead.",
};

export class AiProviderError extends Error {
  readonly code: AiErrorCode;
  readonly httpStatus: number;
  readonly retryable: boolean;

  constructor(code: AiErrorCode, httpStatus: number, retryable: boolean, cause?: unknown) {
    super(AI_ERROR_MESSAGES[code]);
    this.name = "AiProviderError";
    this.code = code;
    this.httpStatus = httpStatus;
    this.retryable = retryable;
    if (cause !== undefined) this.cause = cause;
  }
}

const RETRYABLE_STATUS_CODES = new Set([408, 429, 500, 502, 503, 504]);

/**
 * Maps a thrown error from the AI provider client (or our own timeout wrapper) to a
 * typed AiProviderError. Deterministic failures (400/403, content-safety blocks) are
 * never retried; transient ones (429/5xx/timeout) are.
 */
export function mapProviderError(err: unknown): AiProviderError {
  if (err instanceof AiProviderError) return err;

  const status = extractStatus(err);
  const message = err instanceof Error ? err.message : String(err);

  if (isTimeout(err)) {
    return new AiProviderError("timeout", 504, true, err);
  }
  if (status === 429) {
    return new AiProviderError("upstream_quota_exceeded", 429, true, err);
  }
  if (status !== undefined && RETRYABLE_STATUS_CODES.has(status)) {
    return new AiProviderError("upstream_unavailable", 503, true, err);
  }
  if (/safety|blocked|content.?filter/i.test(message)) {
    return new AiProviderError("content_blocked", 502, false, err);
  }
  if (status !== undefined && status >= 400 && status < 500) {
    return new AiProviderError("service_error", 502, false, err);
  }
  return new AiProviderError("unknown_error", 502, false, err);
}

function extractStatus(err: unknown): number | undefined {
  if (typeof err !== "object" || err === null) return undefined;
  const candidate = err as { status?: unknown; code?: unknown; response?: { status?: unknown } };
  if (typeof candidate.status === "number") return candidate.status;
  if (typeof candidate.response?.status === "number") return candidate.response.status;
  if (typeof candidate.code === "number") return candidate.code;
  return undefined;
}

function isTimeout(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false;
  const candidate = err as { name?: unknown; code?: unknown };
  return candidate.name === "AbortError" || candidate.code === "ETIMEDOUT" || candidate.code === "ECONNABORTED";
}

/**
 * Bounds total wall-clock time for the AI call so a slow or hung provider can never
 * stall the approval HTTP response indefinitely (ADK/Gemini's own SDK has no built-in
 * request timeout). Races the real call against a timer; on timeout the caller gets a
 * retryable "timeout" AiProviderError immediately, and the abandoned call is left to
 * resolve in the background and is simply discarded.
 */
export async function withTimeout<T>(fn: () => Promise<T>, timeoutMs = 15_000): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new AiProviderError("timeout", 504, true)), timeoutMs);
  });
  try {
    return await Promise.race([fn(), timeout]);
  } finally {
    clearTimeout(timer!);
  }
}

/** Small exponential backoff, only ever invoked for retryable AiProviderErrors. */
export async function withRetry<T>(fn: () => Promise<T>, maxAttempts = 2): Promise<T> {
  let lastError: AiProviderError | undefined;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const mapped = mapProviderError(err);
      lastError = mapped;
      if (!mapped.retryable || attempt === maxAttempts) throw mapped;
      const delayMs = 250 * 2 ** (attempt - 1);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  // Unreachable, but keeps TS happy.
  throw lastError ?? new AiProviderError("unknown_error", 502, false);
}
