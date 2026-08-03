/**
 * Guardrails for the approval-message agent, ported (not copied — the reference is Python)
 * from reference_projects/ai_agent_service/agent_system/callbacks.py.
 *
 * Scope note: unlike that project's open-ended chatbot, this agent only ever sees one
 * piece of untrusted free text (the manager's optional approval note) plus data the
 * backend fetches itself via the getLeaveRequestDetails tool. So the pattern list here
 * is a focused subset of the ~35-pattern list there, covering the categories that matter
 * for a single-shot "write a friendly message" call: instruction override, role
 * hijacking, system-prompt extraction, delimiter injection, and encoded-payload markers.
 */

const MAX_NOTE_LENGTH = 500;
const MAX_OUTPUT_LENGTH = 600;

// Leetspeak substitution map, applied before pattern matching so obfuscated attempts
// ("1gn0r3 pr3v10us 1nstruct10ns") still get caught.
const LEET_MAP: Record<string, string> = {
  "0": "o",
  "1": "i",
  "3": "e",
  "4": "a",
  "5": "s",
  "7": "t",
  "@": "a",
  $: "s",
  "!": "i",
};

const INVISIBLE_RE = /[​-‏‪-‮﻿]/g;

function normalize(text: string): string {
  let out = text.replace(INVISIBLE_RE, "");
  out = out.normalize("NFKD").replace(/[̀-ͯ]/g, ""); // strip accents
  out = out.replace(/[-.|_/\\]+/g, " "); // collapse separator punctuation
  out = out
    .toLowerCase()
    .split("")
    .map((ch) => LEET_MAP[ch] ?? ch)
    .join("");
  return out.replace(/\s+/g, " ").trim();
}

const JAILBREAK_PATTERNS: RegExp[] = [
  // Instruction override / manipulation
  /ignore (all |any )?(previous|prior|above) (instructions|prompts|rules)/i,
  /disregard (all |any )?(previous|prior|above) (instructions|prompts|rules)/i,
  /forget (all |any )?(previous|prior|your) (instructions|prompts|rules|training)/i,
  /new (instructions|rules|task)s?:/i,
  /you (must|will) now/i,
  // Role hijacking / known jailbreak personas
  /pretend (you are|to be)/i,
  /act as if you (are|were)/i,
  /you are (now )?(dan|stan|dude|aim|kevin|jailbreak)\b/i,
  /roleplay as/i,
  // System-prompt / instruction extraction
  /(reveal|show|print|repeat|output) (your |the )?(system prompt|instructions|guardrails)/i,
  /what (are|were) you (told|instructed) to do/i,
  /spell out your instructions/i,
  // Tool / architecture probing
  /what (tools|functions|model) (do you|are you) (have|using|powered by)/i,
  /are you (gemini|gpt|claude|an? llm)/i,
  // Delimiter / context injection
  /<\s*system\s*>/i,
  /\[\s*inst\s*\]/i,
  /```[\s\S]*(system|instruction)/i,
  // Encoded-payload markers
  /base64:/i,
  /rot13:/i,
];

export interface GuardrailResult<T> {
  allowed: boolean;
  value: T;
  blockedReason?: string;
}

/**
 * before_model equivalent: validates the manager's free-text note before it's placed
 * into the agent prompt. Returns either the (possibly trimmed) safe note, or a block
 * signal — never throws, since a guardrail hit is an expected outcome, not an error.
 */
export function guardManagerNote(note: string | null | undefined): GuardrailResult<string | null> {
  if (!note) return { allowed: true, value: null };

  if (note.length > MAX_NOTE_LENGTH) {
    return { allowed: false, value: null, blockedReason: "note_too_long" };
  }

  const normalized = normalize(note);
  for (const pattern of JAILBREAK_PATTERNS) {
    if (pattern.test(normalized)) {
      return { allowed: false, value: null, blockedReason: "jailbreak_pattern_matched" };
    }
  }

  return { allowed: true, value: note };
}

// Soft-scrub: strip accidental leakage of internal implementation details from an
// otherwise-fine response, rather than blocking the whole message for a minor leak.
const INTERNAL_DETAIL_PATTERNS: Array<[RegExp, string]> = [
  [/\bgemini\b/gi, "the AI assistant"],
  [/\bgoogle adk\b/gi, "the AI assistant"],
  [/\bLlmAgent\b/gi, "the AI assistant"],
  [/\bgetLeaveRequestDetails\b/gi, ""],
  [/\bsystem prompt\b/gi, "instructions"],
];

const HARD_BLOCK_PATTERNS: RegExp[] = [/before_?model_?callback/i, /after_?model_?callback/i, /before_?tool_?callback/i];

/**
 * after_model equivalent: sanitizes the model's output before it's stored/displayed.
 * Hard-blocks (replaces the whole message) if internal guardrail/implementation names
 * leak verbatim; otherwise soft-scrubs known internal-detail mentions and enforces a
 * length cap and plain-text shape.
 */
export function guardModelOutput(text: string): GuardrailResult<string> {
  if (!text || !text.trim()) {
    return { allowed: false, value: "", blockedReason: "empty_response" };
  }

  for (const pattern of HARD_BLOCK_PATTERNS) {
    if (pattern.test(text)) {
      return { allowed: false, value: "", blockedReason: "internal_detail_leak" };
    }
  }

  let scrubbed = text;
  for (const [pattern, replacement] of INTERNAL_DETAIL_PATTERNS) {
    scrubbed = scrubbed.replace(pattern, replacement);
  }

  scrubbed = scrubbed.trim();
  if (scrubbed.length > MAX_OUTPUT_LENGTH) {
    scrubbed = `${scrubbed.slice(0, MAX_OUTPUT_LENGTH).trim()}...`;
  }

  return { allowed: true, value: scrubbed };
}

/**
 * before_tool equivalent: validates the getLeaveRequestDetails tool argument before
 * it executes. The model picks *that* it wants details for a leave request id, but the
 * tool implementation (see agent.ts) re-derives authorization itself — this guardrail
 * only rejects obviously malformed input so a bad tool call fails fast and cheaply
 * instead of hitting the database with garbage.
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function guardToolArgs(args: unknown): GuardrailResult<{ leaveRequestId: string }> {
  if (typeof args !== "object" || args === null || !("leaveRequestId" in args)) {
    return { allowed: false, value: { leaveRequestId: "" }, blockedReason: "missing_leave_request_id" };
  }
  const leaveRequestId = (args as { leaveRequestId: unknown }).leaveRequestId;
  if (typeof leaveRequestId !== "string" || !UUID_RE.test(leaveRequestId)) {
    return { allowed: false, value: { leaveRequestId: "" }, blockedReason: "invalid_leave_request_id" };
  }
  return { allowed: true, value: { leaveRequestId } };
}
