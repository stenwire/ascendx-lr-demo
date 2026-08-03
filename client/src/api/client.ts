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

export interface ApiError {
  error: { code: string; field?: string; message: string };
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
  const body = await res.json();
  if (!res.ok) {
    const err = body as ApiError;
    throw new Error(err.error?.message ?? `Request failed with status ${res.status}`);
  }
  return body as T;
}

export function listEmployees(): Promise<{ employees: Employee[] }> {
  return request("/employees", null);
}

export function createLeaveRequest(
  employeeId: string,
  input: { startDate: string; endDate: string; reason: string },
): Promise<{ leaveRequest: LeaveRequest }> {
  return request("/leave-requests", employeeId, { method: "POST", body: JSON.stringify(input) });
}

export function listMyLeaveRequests(employeeId: string): Promise<{ leaveRequests: LeaveRequest[] }> {
  return request(`/leave-requests?employee_id=${employeeId}`, employeeId);
}

export function listPendingQueue(managerId: string): Promise<{ leaveRequests: LeaveRequest[] }> {
  return request(`/leave-requests?status=pending`, managerId);
}

export function getLeaveRequest(viewerId: string, leaveRequestId: string): Promise<{ leaveRequest: LeaveRequest }> {
  return request(`/leave-requests/${leaveRequestId}`, viewerId);
}

export function listLeaveRequestsFor(viewerId: string, targetEmployeeId: string): Promise<{ leaveRequests: LeaveRequest[] }> {
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
  return results.flatMap((r) => r.leaveRequests);
}

export function retryAiMessage(
  viewerId: string,
  leaveRequestId: string,
  managerNote?: string,
): Promise<{ leaveRequest: LeaveRequest }> {
  return request(`/leave-requests/${leaveRequestId}/retry-ai-message`, viewerId, {
    method: "POST",
    body: JSON.stringify(managerNote ? { managerNote } : {}),
  });
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
