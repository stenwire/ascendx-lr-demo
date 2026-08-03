import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { ALEX, BO, makeRequest } from "../test/fixtures";
import { mockFetch, renderApp } from "../test/renderApp";
import { AccountMenu } from "../components/layout/AccountMenu";
import { MyRequestsPage } from "../pages/MyRequestsPage";

/** Reproduces: switching the signed-in employee should reload their data. */
describe("switching the signed-in employee", () => {
  beforeEach(() => localStorage.clear());

  it("reloads the request list for the newly selected employee", async () => {
    const user = userEvent.setup();
    const fetchSpy = mockFetch({
      byEmployee: {
        [ALEX.id]: [makeRequest({ id: "a1", employeeId: ALEX.id, reason: "Alex holiday" })],
        [BO.id]: [makeRequest({ id: "b1", employeeId: BO.id, reason: "Bo moving house" })],
      },
    });

    renderApp(
      <>
        <AccountMenu />
        <MyRequestsPage />
      </>,
      { route: "/requests", signedInAs: ALEX.id },
    );

    // DataTable renders a table and a card list; jsdom applies no CSS, so both
    // are present. findAllByText keeps the query unambiguous.
    expect(await screen.findAllByText("Alex holiday")).not.toHaveLength(0);

    // Switch to Bo through the account menu, as a user would.
    await user.click(screen.getByRole("button", { name: /Alex Chen/ }));
    await user.click(await screen.findByRole("menuitem", { name: /Bo Idris/ }));

    expect(await screen.findAllByText("Bo moving house")).not.toHaveLength(0);
    expect(screen.queryAllByText("Alex holiday")).toHaveLength(0);

    const requested = fetchSpy.mock.calls.map((c) => String(c[0]));
    expect(requested.some((u) => u.includes(`employee_id=${BO.id}`))).toBe(true);
  });

  it("sends the newly selected employee in the x-employee-id header", async () => {
    const user = userEvent.setup();
    const fetchSpy = mockFetch({ byEmployee: { [ALEX.id]: [], [BO.id]: [] } });

    renderApp(
      <>
        <AccountMenu />
        <MyRequestsPage />
      </>,
      { route: "/requests", signedInAs: ALEX.id },
    );

    await screen.findByText("You haven't requested any leave yet.");

    await user.click(screen.getByRole("button", { name: /Alex Chen/ }));
    await user.click(await screen.findByRole("menuitem", { name: /Bo Idris/ }));

    await waitFor(() => {
      const headers = fetchSpy.mock.calls
        .map((c) => (c[1] as RequestInit | undefined)?.headers as Record<string, string> | undefined)
        .filter(Boolean);
      expect(headers.some((h) => h!["x-employee-id"] === BO.id)).toBe(true);
    });
  });
});
