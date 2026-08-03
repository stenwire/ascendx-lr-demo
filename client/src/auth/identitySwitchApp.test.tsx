import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { App } from "../App";
import { ALEX, BO, MANAGER, makeRequest } from "../test/fixtures";
import { mockFetch } from "../test/renderApp";

/**
 * The isolated switch test passes; this exercises the real composition —
 * BrowserRouter, AppLayout and the page rendered through <Outlet /> — in case
 * something there holds on to the previous employee's data.
 */
describe("switching employee in the full app", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("ascendx.tourSeen", "1");
    window.history.pushState({}, "", "/requests");
  });

  it("replaces the visible requests with the newly selected employee's", async () => {
    const user = userEvent.setup();
    localStorage.setItem("ascendx.employeeId", ALEX.id);

    mockFetch({
      pending: [],
      byEmployee: {
        [ALEX.id]: [makeRequest({ id: "a1", employeeId: ALEX.id, reason: "Alex holiday" })],
        [BO.id]: [makeRequest({ id: "b1", employeeId: BO.id, reason: "Bo moving house" })],
      },
    });

    render(<App />);

    expect(await screen.findAllByText("Alex holiday")).not.toHaveLength(0);

    await user.click(await screen.findByRole("button", { name: /Alex Chen/ }));
    await user.click(await screen.findByRole("menuitem", { name: /Bo Idris/ }));

    expect(await screen.findAllByText("Bo moving house")).not.toHaveLength(0);
    expect(screen.queryAllByText("Alex holiday")).toHaveLength(0);
  });

  it("updates the overview greeting and stats when the employee changes", async () => {
    const user = userEvent.setup();
    window.history.pushState({}, "", "/");
    localStorage.setItem("ascendx.employeeId", ALEX.id);

    mockFetch({
      pending: [],
      byEmployee: {
        [ALEX.id]: [makeRequest({ id: "a1", employeeId: ALEX.id, reason: "Alex holiday" })],
        [MANAGER.id]: [],
      },
    });

    render(<App />);

    expect(await screen.findByRole("heading", { name: "Welcome, Alex" })).toBeInTheDocument();

    await user.click(await screen.findByRole("button", { name: /Alex Chen/ }));
    await user.click(await screen.findByRole("menuitem", { name: /Dana Wale/ }));

    expect(await screen.findByRole("heading", { name: "Welcome, Dana" })).toBeInTheDocument();
    // Manager-only navigation should appear for Dana.
    expect(await screen.findByRole("link", { name: /Approvals/ })).toBeInTheDocument();
  });
});
