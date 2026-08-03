import type { Employee, LeaveRequest } from "../api/client";

export const MANAGER: Employee = {
  id: "mgr-1",
  name: "Dana Wale",
  managerId: null,
  teamId: "support",
};

export const ALEX: Employee = { id: "emp-1", name: "Alex Chen", managerId: "mgr-1", teamId: "support" };
export const BO: Employee = { id: "emp-2", name: "Bo Idris", managerId: "mgr-1", teamId: "support" };
export const CASEY: Employee = { id: "emp-3", name: "Casey Nwosu", managerId: "mgr-1", teamId: "support" };

/** Not on the manager's team — used to prove queue scoping. */
export const OUTSIDER: Employee = { id: "emp-9", name: "Sam Okafor", managerId: "mgr-9", teamId: "sales" };

export const EMPLOYEES: Employee[] = [ALEX, BO, CASEY, MANAGER, OUTSIDER];

export function makeRequest(overrides: Partial<LeaveRequest> = {}): LeaveRequest {
  return {
    id: "req-1",
    employeeId: ALEX.id,
    startDate: "2026-09-10T00:00:00.000Z",
    endDate: "2026-09-14T00:00:00.000Z",
    reason: "Family holiday",
    managerNote: null,
    status: "pending",
    aiMessage: null,
    decidedById: null,
    createdAt: "2026-09-01T09:30:00.000Z",
    decidedAt: null,
    ...overrides,
  };
}
