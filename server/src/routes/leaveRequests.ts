import { Router } from "express";
import { LeaveStatus } from "@prisma/client";
import { z } from "zod";
import { requireUser } from "../middleware/auth.js";
import { failureResponse, successResponse } from "../utils/apiResponse.js";
import {
  createLeaveRequest,
  decideLeaveRequest,
  getLeaveRequestById,
  listLeaveRequests,
  retryApprovalMessage,
  ValidationError,
} from "../services/leaveRequestService.js";

export const leaveRequestsRouter = Router();
leaveRequestsRouter.use(requireUser);

const createSchema = z.object({
  startDate: z.string(),
  endDate: z.string(),
  reason: z.string().min(1),
});

/**
 * @openapi
 * /leave-requests:
 *   post:
 *     summary: Submit a leave request
 *     tags: [LeaveRequests]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [startDate, endDate, reason]
 *             properties:
 *               startDate:
 *                 type: string
 *                 format: date
 *               endDate:
 *                 type: string
 *                 format: date
 *               reason:
 *                 type: string
 *     responses:
 *       201:
 *         description: The created leave request.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status: { type: string, enum: [success] }
 *                 message: { type: string }
 *                 data:
 *                   $ref: '#/components/schemas/LeaveRequest'
 *       400:
 *         description: Invalid input.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Missing or unknown x-employee-id.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
leaveRequestsRouter.post("/", async (req, res, next) => {
  try {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      return failureResponse(res, { code: "invalid_input", message: parsed.error.issues[0]?.message ?? "Invalid input." });
    }
    const leaveRequest = await createLeaveRequest({ employeeId: req.user!.id, ...parsed.data });
    successResponse(res, { statusCode: 201, data: leaveRequest, message: "Leave request submitted." });
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 * /leave-requests:
 *   get:
 *     summary: List leave requests
 *     description: >
 *       Provide `employee_id` for a specific employee's requests, or `status=pending`
 *       (with no `employee_id`) for a manager's approval queue. Reads are scoped to the
 *       caller: their own records, plus their direct reports'. Asking for anyone else's
 *       `employee_id` is refused, and the queue only ever contains the caller's reports.
 *     tags: [LeaveRequests]
 *     parameters:
 *       - in: query
 *         name: employee_id
 *         schema: { type: string, format: uuid }
 *         description: Return only this employee's requests.
 *       - in: query
 *         name: status
 *         schema: { $ref: '#/components/schemas/LeaveStatus' }
 *         description: Filter by status. Required (and must be `pending`) when employee_id is omitted.
 *     responses:
 *       200:
 *         description: Matching leave requests.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status: { type: string, enum: [success] }
 *                 message: { type: string }
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/LeaveRequest'
 *       400:
 *         description: Missing employee_id/status, or an unknown status value.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: The requested employee_id is neither the caller nor one of their reports.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
leaveRequestsRouter.get("/", async (req, res, next) => {
  try {
    const { employee_id: employeeIdParam, status: statusParam } = req.query;

    let status: LeaveStatus | undefined;
    if (typeof statusParam === "string") {
      if (!Object.values(LeaveStatus).includes(statusParam as LeaveStatus)) {
        return failureResponse(res, { code: "invalid_input", field: "status", message: "Unknown status." });
      }
      status = statusParam as LeaveStatus;
    }

    // A manager's "queue" is any pending request; anything scoped to a specific
    // employee_id is that employee's own requests. No cross-employee listing without
    // a status filter, keeping this a plain authenticated read, not an admin export.
    const employeeId = typeof employeeIdParam === "string" ? employeeIdParam : undefined;
    if (!employeeId && status !== LeaveStatus.pending) {
      return failureResponse(res, {
        code: "invalid_input",
        message: "Provide employee_id, or status=pending for a manager queue.",
      });
    }

    const leaveRequests = await listLeaveRequests({ viewerId: req.user!.id, employeeId, status });
    successResponse(res, { data: leaveRequests, message: "Leave requests retrieved." });
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 * /leave-requests/{id}:
 *   get:
 *     summary: Get a leave request by id
 *     description: >
 *       Readable by the employee it belongs to and by their manager. Anyone else gets
 *       404 rather than 403, so an id cannot be used to confirm that someone else's
 *       request exists.
 *     tags: [LeaveRequests]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: The leave request.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status: { type: string, enum: [success] }
 *                 message: { type: string }
 *                 data:
 *                   $ref: '#/components/schemas/LeaveRequest'
 *       404:
 *         description: No leave request with that id.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
leaveRequestsRouter.get("/:id", async (req, res, next) => {
  try {
    const leaveRequest = await getLeaveRequestById(req.params.id, req.user!.id);
    if (!leaveRequest) {
      return failureResponse(res, { statusCode: 404, code: "not_found", message: "Leave request not found." });
    }
    successResponse(res, { data: leaveRequest, message: "Leave request retrieved." });
  } catch (err) {
    next(err);
  }
});

const patchSchema = z.object({
  status: z.enum(["approved", "rejected"]),
  acknowledgeStaffingWarning: z.boolean().optional(),
});

/**
 * @openapi
 * /leave-requests/{id}:
 *   patch:
 *     summary: Approve or reject a leave request
 *     description: >
 *       Transactionally updates status and generates the AI approval message. If approving
 *       would drop team availability below the configured threshold, responds 200 with
 *       `decided: false` and a `staffingWarning` instead of applying the decision; resend
 *       with `acknowledgeStaffingWarning: true` to proceed anyway.
 *     tags: [LeaveRequests]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [status]
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [approved, rejected]
 *               acknowledgeStaffingWarning:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: The decision was applied, or a staffing warning was returned instead.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status: { type: string, enum: [success] }
 *                 message: { type: string }
 *                 data:
 *                   $ref: '#/components/schemas/DecisionResult'
 *       400:
 *         description: Invalid input.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Not this employee's manager.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: No leave request with that id.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
leaveRequestsRouter.patch("/:id", async (req, res, next) => {
  try {
    const parsed = patchSchema.safeParse(req.body);
    if (!parsed.success) {
      return failureResponse(res, { code: "invalid_input", message: parsed.error.issues[0]?.message ?? "Invalid input." });
    }

    const result = await decideLeaveRequest({
      leaveRequestId: req.params.id,
      deciderId: req.user!.id,
      decision: parsed.data.status,
      acknowledgeStaffingWarning: parsed.data.acknowledgeStaffingWarning,
    });

    if (result.staffingWarning) {
      return successResponse(res, {
        data: { leaveRequest: result.leaveRequest, staffingWarning: result.staffingWarning, decided: false },
        message: "Approving this would leave the team short-staffed. Confirm to continue.",
      });
    }
    successResponse(res, {
      data: { leaveRequest: result.leaveRequest, staffingWarning: null, decided: true },
      message: `Leave request ${parsed.data.status}.`,
    });
  } catch (err) {
    next(err);
  }
});

const retrySchema = z.object({ managerNote: z.string().max(500).optional() });

/**
 * @openapi
 * /leave-requests/{id}/retry-ai-message:
 *   post:
 *     summary: Regenerate the AI approval message
 *     description: >
 *       Used after an AI failure fell back to the default templated message. Restricted to
 *       the employee's manager; anyone who cannot see the request at all gets 404.
 *     tags: [LeaveRequests]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               managerNote:
 *                 type: string
 *                 maxLength: 500
 *     responses:
 *       200:
 *         description: The leave request with a freshly generated (or re-fallback) AI message.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status: { type: string, enum: [success] }
 *                 message: { type: string }
 *                 data:
 *                   $ref: '#/components/schemas/LeaveRequest'
 *       400:
 *         description: Invalid input.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: No leave request with that id.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
leaveRequestsRouter.post("/:id/retry-ai-message", async (req, res, next) => {
  try {
    const parsed = retrySchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return failureResponse(res, { code: "invalid_input", message: parsed.error.issues[0]?.message ?? "Invalid input." });
    }
    const leaveRequest = await retryApprovalMessage(req.params.id, req.user!.id, parsed.data.managerNote);
    successResponse(res, { data: leaveRequest, message: "Approval message regenerated." });
  } catch (err) {
    next(err);
  }
});
