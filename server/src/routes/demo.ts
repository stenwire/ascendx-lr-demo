import { Router } from "express";
import { prisma } from "../db/prisma.js";
import { requireUser } from "../middleware/auth.js";
import { resetDemoLeaveRequests } from "../services/demoData.js";
import { failureResponse, successResponse } from "../utils/apiResponse.js";

export const demoRouter = Router();
demoRouter.use(requireUser);

/**
 * @openapi
 * /demo/reset-leave-requests:
 *   post:
 *     summary: Restore leave requests to the seeded demo set
 *     description: >
 *       Deletes every leave request and recreates the sample set. Employees are left
 *       untouched, so the id each browser stores as its identity stays valid.
 *       Restricted to managers.
 *     tags: [Demo]
 *     responses:
 *       200:
 *         description: Leave requests were restored.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status: { type: string, enum: [success] }
 *                 message: { type: string }
 *                 data:
 *                   type: object
 *                   properties:
 *                     count: { type: integer, description: Number of sample requests created. }
 *       403:
 *         description: Only a manager may reset the demo data.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       409:
 *         description: The seeded team is missing, so there is nothing to restore against.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
demoRouter.post("/reset-leave-requests", async (req, res, next) => {
  try {
    const reports = await prisma.employee.count({ where: { managerId: req.user!.id } });
    if (reports === 0) {
      return failureResponse(res, {
        statusCode: 403,
        code: "forbidden",
        message: "Only a manager can restore the demo data.",
      });
    }

    const count = await resetDemoLeaveRequests(prisma);
    successResponse(res, {
      data: { count },
      message: `Restored ${count} sample leave requests.`,
    });
  } catch (err) {
    if (err instanceof Error && err.message.includes("Demo team not found")) {
      return failureResponse(res, {
        statusCode: 409,
        code: "demo_team_missing",
        message: "The seeded team is missing. Run the seed before restoring demo data.",
      });
    }
    next(err);
  }
});
