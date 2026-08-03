import { render } from "@testing-library/react";
import type { ReactElement } from "react";
import { MemoryRouter } from "react-router-dom";
import { vi } from "vitest";
import { IdentityProvider, useIdentity } from "../auth/IdentityContext";
import { WalkthroughProvider } from "../walkthrough/WalkthroughContext";
import { EMPLOYEES } from "./fixtures";
import type { Employee, LeaveRequest } from "../api/client";

export interface MockApi {
  employees?: Employee[];
  /** Keyed by employee id — the response to GET /leave-requests?employee_id=… */
  byEmployee?: Record<string, LeaveRequest[]>;
  /** The response to GET /leave-requests?status=pending */
  pending?: LeaveRequest[];
  /** Keyed by request id — the response to GET /leave-requests/:id */
  byId?: Record<string, LeaveRequest>;
  /** Called for PATCH /leave-requests/:id; returns the raw response body. */
  onDecide?: (id: string, body: Record<string, unknown>) => unknown;
  onRetryMessage?: (id: string) => unknown;
  onCreate?: (body: Record<string, unknown>) => unknown;
}

/**
 * Stubs global fetch with a tiny router matching the real API's shapes, so page
 * tests exercise the same request/response contract the server implements.
 */
export function mockFetch(api: MockApi = {}) {
  const employees = api.employees ?? EMPLOYEES;

  const spy = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    const method = (init?.method ?? "GET").toUpperCase();
    const body = init?.body ? JSON.parse(String(init.body)) : {};

    // Mirrors the server's response envelope (server/src/utils/apiResponse.ts),
    // so tests exercise the same contract the client parses in production.
    const ok = (data: unknown, status = 200) =>
      ({
        ok: true,
        status,
        json: async () => ({ status: "success", message: "OK", data }),
      }) as Response;

    const fail = (message: string, code: string, status = 400) =>
      ({
        ok: false,
        status,
        json: async () => ({ status: "error", message, data: null, code }),
      }) as Response;

    if (url.startsWith("/employees")) return ok(employees);

    const detail = url.match(/^\/leave-requests\/([^/?]+)$/);
    if (detail && method === "GET") {
      const found = api.byId?.[detail[1]];
      return found ? ok(found) : fail("Leave request not found.", "not_found", 404);
    }
    if (detail && method === "PATCH") return ok(api.onDecide?.(detail[1], body) ?? {});

    const retry = url.match(/^\/leave-requests\/([^/?]+)\/retry-ai-message$/);
    if (retry) return ok(api.onRetryMessage?.(retry[1]) ?? {});

    if (url.startsWith("/leave-requests")) {
      if (method === "POST") return ok(api.onCreate?.(body) ?? {}, 201);

      const query = new URLSearchParams(url.split("?")[1] ?? "");
      const employeeId = query.get("employee_id");
      if (employeeId) return ok(api.byEmployee?.[employeeId] ?? []);
      if (query.get("status") === "pending") return ok(api.pending ?? []);
    }

    return fail(`Unhandled ${method} ${url}`, "not_found", 404);
  });

  vi.stubGlobal("fetch", spy);
  return spy;
}

/**
 * Mirrors AppLayout, which holds the render until identity resolves. Pages assume
 * a signed-in user, so a harness without this gate would fail in a way the real
 * app never does.
 */
function IdentityGate({ children }: { children: ReactElement }) {
  const { me, loading } = useIdentity();
  if (loading || !me) return null;
  return children;
}

export function renderApp(ui: ReactElement, { route = "/", signedInAs }: { route?: string; signedInAs?: string } = {}) {
  if (signedInAs) localStorage.setItem("ascendx.employeeId", signedInAs);

  return render(
    <IdentityProvider>
      <MemoryRouter initialEntries={[route]}>
        <WalkthroughProvider>
          <IdentityGate>{ui}</IdentityGate>
        </WalkthroughProvider>
      </MemoryRouter>
    </IdentityProvider>,
  );
}
