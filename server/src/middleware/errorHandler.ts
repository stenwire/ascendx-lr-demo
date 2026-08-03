import type { NextFunction, Request, Response } from "express";
import { ForbiddenError, NotFoundError, ValidationError } from "../services/leaveRequestService.js";
import { failureResponse } from "../utils/apiResponse.js";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ValidationError) {
    return failureResponse(res, { statusCode: 400, code: "invalid_input", message: err.message, field: err.field });
  }
  if (err instanceof ForbiddenError) {
    return failureResponse(res, { statusCode: 403, code: "forbidden", message: err.message });
  }
  if (err instanceof NotFoundError) {
    return failureResponse(res, { statusCode: 404, code: "not_found", message: err.message });
  }
  console.error(err);
  return failureResponse(res, { statusCode: 500, code: "internal_error", message: "Something went wrong." });
}
