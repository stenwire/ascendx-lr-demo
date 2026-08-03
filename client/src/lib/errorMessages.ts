import { ApiError } from "../api/client";

/**
 * Single owner of user-facing failure copy, mirroring the server's
 * AI_ERROR_MESSAGES table: the interface says what happened and what to do
 * about it, never "Request failed with status 404."
 *
 * Errors don't apologise and are never vague about what went wrong.
 */
const MESSAGES: Record<string, string> = {
  unauthenticated: "That employee is no longer recognised. Pick someone from the account menu and try again.",
  forbidden: "You don't have permission to do that. Only the employee's manager can.",
  not_found: "That item no longer exists. It may have been removed or already decided.",
  invalid_input: "Some of the details weren't accepted. Check the highlighted field and try again.",
  demo_team_missing: "The sample team is missing, so there's nothing to restore. Seed the database first.",
  internal_error: "Something went wrong on our side. Try again in a moment.",
  invalid_response: "The server sent something unreadable. It may be restarting — try again in a moment.",
  unknown_error: "That didn't work. Try again in a moment.",
};

/** Falls back on HTTP status when the server sent no code we recognise. */
const STATUS_MESSAGES: Record<number, string> = {
  0: "Couldn't reach the server. Check your connection and try again.",
  401: MESSAGES.unauthenticated,
  403: MESSAGES.forbidden,
  404: "That endpoint isn't available. The app and the API may be out of step.",
  408: "The server took too long to respond. Try again.",
  409: "That conflicts with the current state. Reload and try again.",
  429: "Too many requests. Wait a moment and try again.",
  500: MESSAGES.internal_error,
  502: "The server is unreachable right now. Try again in a moment.",
  503: "The service is temporarily unavailable. Try again in a moment.",
  504: "The server took too long to respond. Try again.",
};

/**
 * Turns anything thrown by the API client into something worth showing a user.
 *
 * A validation failure keeps the server's own message — it names the offending
 * field and is already written for a person. Everything else is mapped, because
 * those messages are written for developers.
 */
export function toUserMessage(error: unknown): string {
  if (error instanceof ApiError) {
    // The server's validation copy is specific and user-ready; ours would be vaguer.
    if (error.code === "invalid_input" && error.message) return error.message;

    return MESSAGES[error.code] ?? STATUS_MESSAGES[error.statusCode] ?? MESSAGES.unknown_error;
  }

  // fetch() rejects with a TypeError when the network is unreachable.
  if (error instanceof TypeError) return STATUS_MESSAGES[0];

  return MESSAGES.unknown_error;
}
