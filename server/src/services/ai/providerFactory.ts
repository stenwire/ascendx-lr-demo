import type { ApprovalMessageProvider } from "./types.js";

let cached: ApprovalMessageProvider | undefined;

function resolveMode(): "mock" | "live" {
  const explicit = process.env.AI_MODE?.toLowerCase();
  if (explicit === "live" || explicit === "mock") return explicit;
  return process.env.GEMINI_API_KEY ? "live" : "mock";
}

/**
 * Single seam for AI provider selection, analogous to AgentFactory._get_model in
 * reference_projects/ai_agent_service/agent_system/agent_factory.py. The live provider
 * is imported lazily so mock mode (and unit tests) never has to load @google/adk.
 */
export async function getProvider(): Promise<ApprovalMessageProvider> {
  if (cached) return cached;

  if (resolveMode() === "live") {
    const { GeminiApprovalMessageProvider } = await import("./agent.js");
    cached = new GeminiApprovalMessageProvider();
  } else {
    const { MockApprovalMessageProvider } = await import("./mockAgent.js");
    cached = new MockApprovalMessageProvider();
  }
  return cached;
}

/** Test-only: clears the cached provider so tests can flip AI_MODE between cases. */
export function resetProviderCache(): void {
  cached = undefined;
}
