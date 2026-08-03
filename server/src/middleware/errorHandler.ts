import type { NextFunction, Request, Response } from "express";
import { ForbiddenError, NotFoundError, ValidationError } from "../services/leaveRequestService.js";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ValidationError) {
    return res.status(400).json({ error: { code: "invalid_input", field: err.field, message: err.message } });
  }
  if (err instanceof ForbiddenError) {
    return res.status(403).json({ error: { code: "forbidden", message: err.message } });
  }
  if (err instanceof NotFoundError) {
    return res.status(404).json({ error: { code: "not_found", message: err.message } });
  }
  console.error(err);
  return res.status(500).json({ error: { code: "internal_error", message: "Something went wrong." } });
}
