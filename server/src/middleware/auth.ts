import type { NextFunction, Request, Response } from "express";
import { prisma } from "../db/prisma.js";

/**
 * Stand-in for real session/JWT auth, out of scope for this assessment's time box.
 * A seeded employee id in the `x-employee-id` header resolves the current user.
 */
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: { id: string; name: string; managerId: string | null; teamId: string };
    }
  }
}

export async function requireUser(req: Request, res: Response, next: NextFunction) {
  const employeeId = req.header("x-employee-id");
  if (!employeeId) {
    return res.status(401).json({ error: { code: "unauthenticated", message: "x-employee-id header is required." } });
  }
  const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
  if (!employee) {
    return res.status(401).json({ error: { code: "unauthenticated", message: "Unknown employee id." } });
  }
  req.user = { id: employee.id, name: employee.name, managerId: employee.managerId, teamId: employee.teamId };
  next();
}

export async function requireManagerOf(employeeId: string, managerId: string): Promise<boolean> {
  const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
  return !!employee && employee.managerId === managerId;
}
