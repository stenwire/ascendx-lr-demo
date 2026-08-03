import type { Response } from "express";

/**
 * Every endpoint answers with the same envelope, so a caller can branch on
 * `status` without knowing which route it came from:
 *
 *   { "status": "success", "message": "…", "data": … }
 *   { "status": "error",   "message": "…", "data": null, "code": "…" }
 *
 * `data` carries the resource itself — an object for a single record, an array
 * for a collection — rather than a second layer of naming.
 */

export interface SuccessBody<T> {
  status: "success";
  message: string;
  data: T;
}

export interface FailureBody {
  status: "error";
  message: string;
  data: null;
  /** Stable machine-readable identifier, e.g. "invalid_input", "not_found". */
  code: string;
  /** Set when the failure is attributable to one input field. */
  field?: string;
}

export function successResponse<T>(
  res: Response,
  options: { data: T; message?: string; statusCode?: number },
): Response {
  const body: SuccessBody<T> = {
    status: "success",
    message: options.message ?? "OK",
    data: options.data,
  };
  return res.status(options.statusCode ?? 200).json(body);
}

export function failureResponse(
  res: Response,
  options: { message: string; code: string; statusCode?: number; field?: string },
): Response {
  const body: FailureBody = {
    status: "error",
    message: options.message,
    data: null,
    code: options.code,
    ...(options.field ? { field: options.field } : {}),
  };
  return res.status(options.statusCode ?? 400).json(body);
}
