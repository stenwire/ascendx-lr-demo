import { mapProviderError, withRetry, withTimeout } from "./errors.js";
import { guardManagerNote, guardModelOutput } from "./guardrails.js";
import { getProvider } from "./providerFactory.js";
import type { ApprovalMessageInput, ApprovalMessageResult } from "./types.js";

/**
 * Single entry point for generating the AI approval message. Guarantees a usable
 * result no matter what: guardrail block, provider error, or malformed output all
 * degrade to the same default templated message rather than failing the caller.
 * The approval itself (see leaveRequestService.ts) never blocks on this.
 */
export async function generateApprovalMessage(input: ApprovalMessageInput): Promise<ApprovalMessageResult> {
  const defaultMessage = buildDefaultMessage(input);

  const noteGuard = guardManagerNote(input.managerNote);
  if (!noteGuard.allowed) {
    console.warn("[ai] manager note blocked by guardrail", { leaveRequestId: input.leaveRequestId, reason: noteGuard.blockedReason });
    return { message: defaultMessage, source: "default", errorCode: "guardrail_blocked" };
  }

  try {
    const provider = await getProvider();
    // 20s per attempt: generous enough to cover ADK's one-time cold-start cost (module
    // init, telemetry setup) on a fresh process, still bounded so a hung provider can
    // never stall the approval response indefinitely.
    const raw = await withRetry(() => withTimeout(() => provider.generate({ ...input, managerNote: noteGuard.value }), 20_000));

    const outputGuard = guardModelOutput(raw);
    if (!outputGuard.allowed) {
      console.warn("[ai] model output blocked by guardrail", { leaveRequestId: input.leaveRequestId, reason: outputGuard.blockedReason });
      return { message: defaultMessage, source: "default", errorCode: "guardrail_blocked" };
    }

    return { message: outputGuard.value, source: "ai" };
  } catch (err) {
    const mapped = mapProviderError(err);
    console.error("[ai] approval message generation failed, falling back to default", {
      leaveRequestId: input.leaveRequestId,
      code: mapped.code,
    });
    return { message: defaultMessage, source: "default", errorCode: mapped.code };
  }
}

function buildDefaultMessage(input: ApprovalMessageInput): string {
  return `Your leave from ${formatDate(input.startDate)} to ${formatDate(input.endDate)} has been approved.`;
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}
