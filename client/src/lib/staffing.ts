import type { LeaveRequest } from "../api/client";
import { addDays, daysBetween, parseDateKey } from "./dates";

/**
 * Mirrors the server's STAFFING_MIN_AVAILABLE_RATIO default (server/.env.example).
 *
 * The server owns the authoritative rule and is the only thing that can block or
 * warn on a decision; this constant exists so the Team timeline can *show* the
 * manager where coverage dips before they act. The value is not exposed over
 * HTTP, so a config endpoint would be the real fix if the server default ever
 * changes.
 */
export const MIN_AVAILABLE_RATIO = 0.5;

export function minRequiredAvailable(teamSize: number): number {
  return Math.ceil(teamSize * MIN_AVAILABLE_RATIO);
}

export interface DayCoverage {
  date: Date;
  onLeave: number;
  available: number;
  understaffed: boolean;
}

/**
 * Per-day availability across a window, counting only approved leave — the same
 * basis the server's checkStaffingShortage uses.
 */
export function computeCoverage(
  requests: LeaveRequest[],
  teamSize: number,
  windowStart: Date,
  windowDays: number,
): DayCoverage[] {
  const minRequired = minRequiredAvailable(teamSize);
  const approved = requests.filter((r) => r.status === "approved");

  return Array.from({ length: windowDays }, (_, offset) => {
    const date = addDays(windowStart, offset);
    const onLeaveIds = new Set(
      approved
        .filter((r) => parseDateKey(r.startDate) <= date && parseDateKey(r.endDate) >= date)
        .map((r) => r.employeeId),
    );
    const onLeave = onLeaveIds.size;
    const available = teamSize - onLeave;
    return { date, onLeave, available, understaffed: available < minRequired };
  });
}

/** Grid column span for a request inside the window, or null if it falls outside. */
export function windowSpan(
  request: LeaveRequest,
  windowStart: Date,
  windowDays: number,
): { startOffset: number; span: number } | null {
  const start = parseDateKey(request.startDate);
  const end = parseDateKey(request.endDate);

  const rawStart = daysBetween(windowStart, start);
  const rawEnd = daysBetween(windowStart, end);
  if (rawEnd < 0 || rawStart > windowDays - 1) return null;

  const startOffset = Math.max(0, rawStart);
  const endOffset = Math.min(windowDays - 1, rawEnd);
  return { startOffset, span: endOffset - startOffset + 1 };
}
