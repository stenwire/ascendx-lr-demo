export interface Employee {
  id: string;
  name: string;
  managerId: string | null;
  teamId: string;
}

export type LeaveStatus = "pending" | "approved" | "rejected";

export interface LeaveRequest {
  id: string;
  employeeId: string;
  startDate: string;
  endDate: string;
  reason: string;
  managerNote: string | null;
  status: LeaveStatus;
  aiMessage: string | null;
  decidedById: string | null;
  createdAt: string;
  decidedAt: string | null;
}

export interface StaffingWarning {
  teamId: string;
  teamSize: number;
  availableAfterApproval: number;
  minRequired: number;
}

/** Every endpoint answers in this envelope; see server/src/utils/apiResponse.ts. */
interface SuccessEnvelope<T> {
  status: "success";
  message: string;
  data: T;
}

interface FailureEnvelope {
  status: "error";
  message: string;
  data: null;
  code: string;
  field?: string;
}

/** Carries the server's machine-readable code so callers can branch on it. */
export class ApiError extends Error {
  readonly code: string;
  readonly field?: string;
  readonly statusCode: number;

  constructor(message: string, code: string, statusCode: number, field?: string) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.field = field;
    this.statusCode = statusCode;
  }
}

async function request<T>(path: string, employeeId: string | null, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(employeeId ? { "x-employee-id": employeeId } : {}),
      ...(init?.headers ?? {}),
    },
  });

  // A proxy or crash can answer with HTML rather than the envelope; surface that
  // as a normal failure instead of a JSON parse error.
  let body: unknown;
  try {
    body = await res.json();
  } catch {
    throw new ApiError(`Request failed with status ${res.status}.`, "invalid_response", res.status);
  }

  if (!res.ok) {
    const failure = body as Partial<FailureEnvelope>;
    throw new ApiError(
      failure?.message ?? `Request failed with status ${res.status}.`,
      failure?.code ?? "unknown_error",
      res.status,
      failure?.field,
    );
  }

  return (body as SuccessEnvelope<T>).data;
}

export function listEmployees(): Promise<Employee[]> {
  return request("/employees", null);
}

export function createLeaveRequest(
  employeeId: string,
  input: { startDate: string; endDate: string; reason: string },
): Promise<LeaveRequest> {
  return request("/leave-requests", employeeId, { method: "POST", body: JSON.stringify(input) });
}

export function listMyLeaveRequests(employeeId: string): Promise<LeaveRequest[]> {
  return request(`/leave-requests?employee_id=${employeeId}`, employeeId);
}

export function listPendingQueue(managerId: string): Promise<LeaveRequest[]> {
  return request(`/leave-requests?status=pending`, managerId);
}

export function getLeaveRequest(viewerId: string, leaveRequestId: string): Promise<LeaveRequest> {
  return request(`/leave-requests/${leaveRequestId}`, viewerId);
}

export function listLeaveRequestsFor(viewerId: string, targetEmployeeId: string): Promise<LeaveRequest[]> {
  return request(`/leave-requests?employee_id=${targetEmployeeId}`, viewerId);
}

/**
 * The API has no "all requests for a team" endpoint — listing is either scoped to
 * one employee or to status=pending across everyone. Fanning out one call per
 * report is fine at this scale (3 reports); a team-scoped endpoint would be the
 * fix if a team ever got large.
 */
export async function listTeamLeaveRequests(viewerId: string, employeeIds: string[]): Promise<LeaveRequest[]> {
  const results = await Promise.all(employeeIds.map((id) => listLeaveRequestsFor(viewerId, id)));
  return results.flat();
}

export function retryAiMessage(
  viewerId: string,
  leaveRequestId: string,
  managerNote?: string,
): Promise<LeaveRequest> {
  return request(`/leave-requests/${leaveRequestId}/retry-ai-message`, viewerId, {
    method: "POST",
    body: JSON.stringify(managerNote ? { managerNote } : {}),
  });
}

/** Manager-only. Replaces all leave requests with the seeded sample set. */
export function resetDemoLeaveRequests(managerId: string): Promise<{ count: number }> {
  return request("/demo/reset-leave-requests", managerId, { method: "POST" });
}

export interface DecideResponse {
  leaveRequest: LeaveRequest;
  staffingWarning: StaffingWarning | null;
  decided: boolean;
}

export function decideLeaveRequest(
  managerId: string,
  leaveRequestId: string,
  status: "approved" | "rejected",
  acknowledgeStaffingWarning?: boolean,
): Promise<DecideResponse> {
  return request(`/leave-requests/${leaveRequestId}`, managerId, {
    method: "PATCH",
    body: JSON.stringify({ status, acknowledgeStaffingWarning }),
  });
}
