import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ALEX, BO, MANAGER, OUTSIDER, makeRequest } from "../test/fixtures";
import { mockFetch, renderApp } from "../test/renderApp";
import { ApprovalsPage } from "./ApprovalsPage";

const alexRequest = makeRequest({ id: "req-alex", employeeId: ALEX.id, reason: "Family holiday" });
const boRequest = makeRequest({ id: "req-bo", employeeId: BO.id, reason: "Moving house" });
const outsiderRequest = makeRequest({ id: "req-outsider", employeeId: OUTSIDER.id, reason: "Not my report" });

function renderAsManager(api: Parameters<typeof mockFetch>[0]) {
  mockFetch(api);
  return renderApp(<ApprovalsPage />, { route: "/approvals", signedInAs: MANAGER.id });
}

describe("ApprovalsPage", () => {
  beforeEach(() => localStorage.clear());

  it("shows only requests from the manager's own direct reports", async () => {
    renderAsManager({ pending: [alexRequest, boRequest, outsiderRequest] });

    expect(await screen.findByText("Alex Chen")).toBeInTheDocument();
    expect(screen.getByText("Bo Idris")).toBeInTheDocument();
    // status=pending returns everyone's pending requests; the page must scope them.
    expect(screen.queryByText("Sam Okafor")).not.toBeInTheDocument();
  });

  it("tells the manager when there is nothing to review", async () => {
    renderAsManager({ pending: [] });
    expect(await screen.findByText("No pending requests.")).toBeInTheDocument();
  });

  it("surfaces a load failure with a retry", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = input.toString();
        if (url.startsWith("/employees")) {
          return { ok: true, status: 200, json: async () => ({ employees: [ALEX, BO, MANAGER] }) } as Response;
        }
        return {
          ok: false,
          status: 500,
          json: async () => ({ error: { code: "internal_error", message: "Something went wrong." } }),
        } as Response;
      }),
    );
    renderApp(<ApprovalsPage />, { route: "/approvals", signedInAs: MANAGER.id });

    expect(await screen.findByText("Something went wrong.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });

  it("approves a request and refreshes the queue", async () => {
    const user = userEvent.setup();
    const onDecide = vi.fn((_id: string, _body: Record<string, unknown>) => ({
      leaveRequest: { ...alexRequest, status: "approved" },
      staffingWarning: null,
      decided: true,
    }));

    let pending = [alexRequest];
    mockFetch({
      get pending() {
        return pending;
      },
      onDecide: (id, body) => {
        pending = [];
        return onDecide(id, body);
      },
    } as Parameters<typeof mockFetch>[0]);
    renderApp(<ApprovalsPage />, { route: "/approvals", signedInAs: MANAGER.id });

    await user.click(await screen.findByRole("button", { name: "Approve" }));

    await waitFor(() => expect(onDecide).toHaveBeenCalledWith("req-alex", expect.objectContaining({ status: "approved" })));
    expect(await screen.findByText("No pending requests.")).toBeInTheDocument();
  });

  describe("staffing shortage", () => {
    // The server answers 200 with decided:false and a warning; nothing is applied
    // until the manager confirms.
    const warning = { teamId: "support", teamSize: 4, availableAfterApproval: 1, minRequired: 2 };

    it("shows the warning and does not treat it as an error", async () => {
      const user = userEvent.setup();
      mockFetch({
        pending: [alexRequest],
        onDecide: () => ({ leaveRequest: alexRequest, staffingWarning: warning, decided: false }),
      });
      renderApp(<ApprovalsPage />, { route: "/approvals", signedInAs: MANAGER.id });

      await user.click(await screen.findByRole("button", { name: "Approve" }));

      expect(await screen.findByText("Approving this leaves the team short")).toBeInTheDocument();
      // Still listed — the decision was held back, not applied.
      expect(screen.getByText("Alex Chen")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Approve anyway" })).toBeInTheDocument();
    });

    it("resends with acknowledgeStaffingWarning when the manager confirms", async () => {
      const user = userEvent.setup();
      const calls: Record<string, unknown>[] = [];
      let pending = [alexRequest];

      mockFetch({
        get pending() {
          return pending;
        },
        onDecide: (_id, body) => {
          calls.push(body);
          if (!body.acknowledgeStaffingWarning) {
            return { leaveRequest: alexRequest, staffingWarning: warning, decided: false };
          }
          pending = [];
          return { leaveRequest: { ...alexRequest, status: "approved" }, staffingWarning: null, decided: true };
        },
      } as Parameters<typeof mockFetch>[0]);
      renderApp(<ApprovalsPage />, { route: "/approvals", signedInAs: MANAGER.id });

      await user.click(await screen.findByRole("button", { name: "Approve" }));
      await user.click(await screen.findByRole("button", { name: "Approve anyway" }));

      await waitFor(() => expect(calls).toHaveLength(2));
      expect(calls[0].acknowledgeStaffingWarning).toBeFalsy();
      expect(calls[1].acknowledgeStaffingWarning).toBe(true);
      expect(await screen.findByText("No pending requests.")).toBeInTheDocument();
    });
  });

  it("rejects without asking for confirmation", async () => {
    const user = userEvent.setup();
    const onDecide = vi.fn(() => ({
      leaveRequest: { ...alexRequest, status: "rejected" },
      staffingWarning: null,
      decided: true,
    }));
    mockFetch({ pending: [alexRequest], onDecide });
    renderApp(<ApprovalsPage />, { route: "/approvals", signedInAs: MANAGER.id });

    await user.click(await screen.findByRole("button", { name: "Reject" }));

    await waitFor(() =>
      expect(onDecide).toHaveBeenCalledWith("req-alex", expect.objectContaining({ status: "rejected" })),
    );
  });
});
