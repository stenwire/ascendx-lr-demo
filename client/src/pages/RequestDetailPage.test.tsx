import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Route, Routes } from "react-router-dom";
import { ALEX, MANAGER, makeRequest } from "../test/fixtures";
import { mockFetch, renderApp } from "../test/renderApp";
import { RequestDetailPage } from "./RequestDetailPage";

function renderDetail(request: ReturnType<typeof makeRequest>, signedInAs: string, api = {}) {
  mockFetch({ byId: { [request.id]: request }, ...api });
  return renderApp(
    <Routes>
      <Route path="/requests/:id" element={<RequestDetailPage />} />
    </Routes>,
    { route: `/requests/${request.id}`, signedInAs },
  );
}

describe("RequestDetailPage", () => {
  beforeEach(() => localStorage.clear());

  it("shows the approval message for an approved request", async () => {
    const approved = makeRequest({
      status: "approved",
      aiMessage: "Hi Alex, your leave has been approved. Enjoy the time off!",
      decidedById: MANAGER.id,
      decidedAt: "2026-09-02T10:00:00.000Z",
    });
    renderDetail(approved, ALEX.id);

    expect(await screen.findByText("Approval message")).toBeInTheDocument();
    expect(screen.getByText(/Enjoy the time off/)).toBeInTheDocument();
  });

  it("omits the message section entirely for a rejected request", async () => {
    // Rejections never generate a message, so an empty card would be misleading.
    const rejected = makeRequest({
      status: "rejected",
      decidedById: MANAGER.id,
      decidedAt: "2026-09-02T10:00:00.000Z",
    });
    renderDetail(rejected, ALEX.id);

    expect(await screen.findByText("Details")).toBeInTheDocument();
    expect(screen.queryByText("Approval message")).not.toBeInTheDocument();
  });

  it("omits the message section for a pending request", async () => {
    renderDetail(makeRequest({ status: "pending" }), ALEX.id);
    expect(await screen.findByText("Details")).toBeInTheDocument();
    expect(screen.queryByText("Approval message")).not.toBeInTheDocument();
    expect(screen.getByText("Waiting for a decision from the manager.")).toBeInTheDocument();
  });

  it("offers regenerate to the manager on an approved request", async () => {
    const approved = makeRequest({ status: "approved", aiMessage: "Original message." });
    renderDetail(approved, MANAGER.id);
    expect(await screen.findByRole("button", { name: /Regenerate/ })).toBeInTheDocument();
  });

  it("hides regenerate from the employee who owns the request", async () => {
    // The endpoint is the manager's tool; showing it to the employee would 403.
    const approved = makeRequest({ status: "approved", aiMessage: "Original message." });
    renderDetail(approved, ALEX.id);
    await screen.findByText("Approval message");
    expect(screen.queryByRole("button", { name: /Regenerate/ })).not.toBeInTheDocument();
  });

  it("calls the retry endpoint and shows the refreshed message", async () => {
    const user = userEvent.setup();
    const approved = makeRequest({ status: "approved", aiMessage: "Original message." });
    const regenerated = { ...approved, aiMessage: "A freshly written message." };
    const onRetryMessage = vi.fn(() => ({ leaveRequest: regenerated }));

    const byId: Record<string, typeof approved> = { [approved.id]: approved };
    mockFetch({
      byId,
      onRetryMessage: (id) => {
        byId[id] = regenerated;
        return onRetryMessage();
      },
    });
    renderApp(
      <Routes>
        <Route path="/requests/:id" element={<RequestDetailPage />} />
      </Routes>,
      { route: `/requests/${approved.id}`, signedInAs: MANAGER.id },
    );

    await user.click(await screen.findByRole("button", { name: /Regenerate/ }));

    await waitFor(() => expect(onRetryMessage).toHaveBeenCalled());
    expect(await screen.findByText("A freshly written message.")).toBeInTheDocument();
  });

  it("shows an error when the request is missing", async () => {
    mockFetch({ byId: {} });
    renderApp(
      <Routes>
        <Route path="/requests/:id" element={<RequestDetailPage />} />
      </Routes>,
      { route: "/requests/does-not-exist", signedInAs: ALEX.id },
    );

    expect(await screen.findByText("Leave request not found.")).toBeInTheDocument();
  });
});
