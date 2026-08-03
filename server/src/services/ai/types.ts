import type { AiErrorCode } from "./errors.js";

export interface ApprovalMessageInput {
  leaveRequestId: string;
  employeeName: string;
  startDate: Date;
  endDate: Date;
  managerNote?: string | null;
}

export interface ApprovalMessageResult {
  message: string;
  source: "ai" | "default";
  errorCode?: AiErrorCode;
}

/** Implemented by both the mock provider and the real adk-js/Gemini provider. */
export interface ApprovalMessageProvider {
  generate(input: ApprovalMessageInput): Promise<string>;
}
