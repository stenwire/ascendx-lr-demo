import type { ApprovalMessageInput, ApprovalMessageProvider } from "./types.js";

/**
 * Offline stand-in for the real Gemini/ADK provider, selected automatically when
 * AI_MODE=mock (the default when GEMINI_API_KEY is unset). Deterministic and free of
 * any external calls so the app runs for a reviewer with zero setup.
 */
export class MockApprovalMessageProvider implements ApprovalMessageProvider {
  async generate(input: ApprovalMessageInput): Promise<string> {
    const firstName = input.employeeName.split(" ")[0];
    const templates = [
      `Hi ${firstName}, your leave from ${formatDate(input.startDate)} to ${formatDate(input.endDate)} has been approved. Enjoy the time off!`,
      `Good news, ${firstName} — you're all set for leave from ${formatDate(input.startDate)} to ${formatDate(input.endDate)}. Have a great break!`,
    ];
    let message = templates[hashToIndex(input.leaveRequestId, templates.length)];
    if (input.managerNote) {
      message += ` Note from your manager: "${input.managerNote}"`;
    }
    return message;
  }
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function hashToIndex(value: string, mod: number): number {
  let hash = 0;
  for (const ch of value) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return hash % mod;
}
