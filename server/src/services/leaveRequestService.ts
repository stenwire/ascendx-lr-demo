import { LeaveStatus, type LeaveRequest } from "@prisma/client";
import { prisma } from "../db/prisma.js";
import { generateApprovalMessage } from "./ai/aiMessageService.js";

export class ValidationError extends Error {
  readonly field: string;
  constructor(field: string, message: string) {
    super(message);
    this.name = "ValidationError";
    this.field = field;
  }
}

export class ForbiddenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ForbiddenError";
  }
}

export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotFoundError";
  }
}

export interface CreateLeaveRequestInput {
  employeeId: string;
  startDate: string;
  endDate: string;
  reason: string;
}

export async function createLeaveRequest(input: CreateLeaveRequestInput): Promise<LeaveRequest> {
  const start = new Date(input.startDate);
  const end = new Date(input.endDate);

  if (Number.isNaN(start.getTime())) throw new ValidationError("startDate", "startDate is not a valid date.");
  if (Number.isNaN(end.getTime())) throw new ValidationError("endDate", "endDate is not a valid date.");
  if (end < start) throw new ValidationError("endDate", "endDate cannot be before startDate.");

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (end < today) throw new ValidationError("endDate", "Leave requests cannot be fully in the past.");

  if (!input.reason || !input.reason.trim()) throw new ValidationError("reason", "reason is required.");

  return prisma.leaveRequest.create({
    data: {
      employeeId: input.employeeId,
      startDate: start,
      endDate: end,
      reason: input.reason.trim(),
      status: LeaveStatus.pending,
    },
  });
}

/**
 * Authorisation rule for reads: an employee sees their own records, and a
 * manager sees their direct reports'. Nobody sees anyone else's, which is what
 * makes an employee id in the URL safe to expose.
 */
export async function canViewRecordsOf(viewerId: string, targetEmployeeId: string): Promise<boolean> {
  if (viewerId === targetEmployeeId) return true;
  const target = await prisma.employee.findUnique({
    where: { id: targetEmployeeId },
    select: { managerId: true },
  });
  return target?.managerId === viewerId;
}

/** Ids the viewer is allowed to read: themselves plus anyone reporting to them. */
async function visibleEmployeeIds(viewerId: string): Promise<string[]> {
  const reports = await prisma.employee.findMany({
    where: { managerId: viewerId },
    select: { id: true },
  });
  return [viewerId, ...reports.map((r) => r.id)];
}

export interface ListLeaveRequestsFilter {
  viewerId: string;
  employeeId?: string;
  status?: LeaveStatus;
}

export async function listLeaveRequests(filter: ListLeaveRequestsFilter): Promise<LeaveRequest[]> {
  if (filter.employeeId) {
    if (!(await canViewRecordsOf(filter.viewerId, filter.employeeId))) {
      throw new ForbiddenError("You can only view your own leave requests, or those of your direct reports.");
    }
    return prisma.leaveRequest.findMany({
      where: { employeeId: filter.employeeId, status: filter.status },
      orderBy: { createdAt: "desc" },
    });
  }

  // No employee_id means the manager queue. Scope it to the viewer's own reports
  // rather than returning every pending request in the company.
  return prisma.leaveRequest.findMany({
    where: { employeeId: { in: await visibleEmployeeIds(filter.viewerId) }, status: filter.status },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Returns null both when the record does not exist and when the viewer may not
 * see it, so the caller answers 404 either way — a 403 would confirm that
 * somebody else's request exists at that id.
 */
export async function getLeaveRequestById(id: string, viewerId: string): Promise<LeaveRequest | null> {
  const leaveRequest = await prisma.leaveRequest.findUnique({ where: { id } });
  if (!leaveRequest) return null;
  return (await canViewRecordsOf(viewerId, leaveRequest.employeeId)) ? leaveRequest : null;
}

const STAFFING_MIN_AVAILABLE_RATIO = Number(process.env.STAFFING_MIN_AVAILABLE_RATIO ?? "0.5");

export interface StaffingWarning {
  teamId: string;
  teamSize: number;
  availableAfterApproval: number;
  minRequired: number;
}

/**
 * Business rule, not AI: counts teammates already on approved leave overlapping the
 * requested dates, and warns (does not block) if approving this one would drop
 * available headcount below the configured minimum ratio.
 */
export async function checkStaffingShortage(leaveRequest: LeaveRequest): Promise<StaffingWarning | null> {
  const employee = await prisma.employee.findUniqueOrThrow({ where: { id: leaveRequest.employeeId } });
  const teamMembers = await prisma.employee.findMany({ where: { teamId: employee.teamId } });
  const teamSize = teamMembers.length;

  const overlappingApproved = await prisma.leaveRequest.findMany({
    where: {
      status: LeaveStatus.approved,
      employeeId: { in: teamMembers.map((m) => m.id) },
      startDate: { lte: leaveRequest.endDate },
      endDate: { gte: leaveRequest.startDate },
    },
  });
  const onLeaveEmployeeIds = new Set(overlappingApproved.map((r) => r.employeeId));
  onLeaveEmployeeIds.add(leaveRequest.employeeId); // this request, if approved

  const availableAfterApproval = teamSize - onLeaveEmployeeIds.size;
  const minRequired = Math.ceil(teamSize * STAFFING_MIN_AVAILABLE_RATIO);

  if (availableAfterApproval < minRequired) {
    return { teamId: employee.teamId, teamSize, availableAfterApproval, minRequired };
  }
  return null;
}

export interface DecideLeaveRequestInput {
  leaveRequestId: string;
  deciderId: string;
  decision: "approved" | "rejected";
  acknowledgeStaffingWarning?: boolean;
}

export interface DecideLeaveRequestResult {
  leaveRequest: LeaveRequest;
  staffingWarning: StaffingWarning | null;
}

export async function decideLeaveRequest(input: DecideLeaveRequestInput): Promise<DecideLeaveRequestResult> {
  const existing = await prisma.leaveRequest.findUnique({ where: { id: input.leaveRequestId } });
  if (!existing) throw new NotFoundError("Leave request not found.");
  if (existing.status !== LeaveStatus.pending) {
    throw new ValidationError("status", `Leave request is already ${existing.status}.`);
  }

  const employee = await prisma.employee.findUnique({ where: { id: existing.employeeId } });
  if (!employee || employee.managerId !== input.deciderId) {
    throw new ForbiddenError("Only the employee's manager can decide this request.");
  }

  if (input.decision === "rejected") {
    // Rejection is just a status update, no AI message: clear text over a "friendly" one.
    const updated = await prisma.leaveRequest.update({
      where: { id: input.leaveRequestId },
      data: { status: LeaveStatus.rejected, decidedById: input.deciderId, decidedAt: new Date() },
    });
    return { leaveRequest: updated, staffingWarning: null };
  }

  const staffingWarning = await checkStaffingShortage(existing);
  if (staffingWarning && !input.acknowledgeStaffingWarning) {
    // Not a hard block: the manager still decides, but must see the warning first.
    return { leaveRequest: existing, staffingWarning };
  }

  // Status update happens in its own transaction so a mid-write failure rolls back
  // rather than leaving a request half-approved. The AI call happens after and is
  // not part of the transaction: on failure it falls back to a default message and
  // is filled in on retry, per the documented design.
  const approved = await prisma.leaveRequest.update({
    where: { id: input.leaveRequestId },
    data: { status: LeaveStatus.approved, decidedById: input.deciderId, decidedAt: new Date() },
  });

  const { message } = await generateApprovalMessage({
    leaveRequestId: approved.id,
    employeeName: employee.name,
    startDate: approved.startDate,
    endDate: approved.endDate,
    managerNote: null,
  });

  const withMessage = await prisma.leaveRequest.update({
    where: { id: approved.id },
    data: { aiMessage: message },
  });

  return { leaveRequest: withMessage, staffingWarning: null };
}

/** Regenerates the AI message for an already-approved request (retry-on-failure path). */
export async function retryApprovalMessage(
  leaveRequestId: string,
  viewerId: string,
  managerNote?: string | null,
): Promise<LeaveRequest> {
  const existing = await prisma.leaveRequest.findUnique({ where: { id: leaveRequestId } });
  // Hidden records are reported as missing, matching getLeaveRequestById.
  if (!existing || !(await canViewRecordsOf(viewerId, existing.employeeId))) {
    throw new NotFoundError("Leave request not found.");
  }
  if (existing.status !== LeaveStatus.approved) {
    throw new ValidationError("status", "Can only regenerate the AI message for an approved request.");
  }

  const employee = await prisma.employee.findUniqueOrThrow({ where: { id: existing.employeeId } });
  // The message is written on the manager's behalf, so only they may rewrite it.
  if (employee.managerId !== viewerId) {
    throw new ForbiddenError("Only the employee's manager can regenerate this message.");
  }

  const { message } = await generateApprovalMessage({
    leaveRequestId: existing.id,
    employeeName: employee.name,
    startDate: existing.startDate,
    endDate: existing.endDate,
    managerNote: managerNote ?? existing.managerNote,
  });

  return prisma.leaveRequest.update({ where: { id: existing.id }, data: { aiMessage: message, managerNote: managerNote ?? existing.managerNote } });
}
