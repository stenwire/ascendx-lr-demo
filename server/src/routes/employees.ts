import { Router } from "express";
import { prisma } from "../db/prisma.js";

export const employeesRouter = Router();

/**
 * @openapi
 * /employees:
 *   get:
 *     summary: List employees
 *     description: >
 *       Unauthenticated on purpose: this only powers the demo frontend's "log in as" picker
 *       (there's no real auth system in this assessment build), not a real employee directory.
 *     tags: [Employees]
 *     security: []
 *     responses:
 *       200:
 *         description: All employees, ordered by name.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 employees:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Employee'
 */
// Unauthenticated on purpose: this only powers the demo frontend's "log in as" picker
// (there's no real auth system in this assessment build), not a real employee directory.
employeesRouter.get("/", async (_req, res, next) => {
  try {
    const employees = await prisma.employee.findMany({
      select: { id: true, name: true, managerId: true, teamId: true },
      orderBy: { name: "asc" },
    });
    res.json({ employees });
  } catch (err) {
    next(err);
  }
});
