import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { ALEX, makeRequest } from "../test/fixtures";
import { mockFetch, renderApp } from "../test/renderApp";
import { MyRequestsPage } from "./MyRequestsPage";

const requests = [
  makeRequest({ id: "r1", status: "pending", reason: "Family holiday" }),
  makeRequest({ id: "r2", status: "approved", reason: "Conference" }),
  makeRequest({ id: "r3", status: "rejected", reason: "Short notice trip" }),
];

/**
 * DataTable renders a table and a card list, with CSS choosing between them.
 * jsdom applies no CSS, so both are in the DOM — queries are scoped to one to
 * stay unambiguous.
 */
const table = () => within(screen.getByRole("table"));

/** Status words also appear in row badges, so filter clicks are scoped here. */
const filters = () => within(screen.getByRole("group", { name: "Filter by status" }));

describe("MyRequestsPage", () => {
  beforeEach(() => localStorage.clear());

  it("lists every request by default", async () => {
    mockFetch({ byEmployee: { [ALEX.id]: requests } });
    renderApp(<MyRequestsPage />, { route: "/requests", signedInAs: ALEX.id });

    await screen.findByRole("table");
    expect(table().getByText("Family holiday")).toBeInTheDocument();
    expect(table().getByText("Conference")).toBeInTheDocument();
    expect(table().getByText("Short notice trip")).toBeInTheDocument();
  });

  it("filters to a single status", async () => {
    const user = userEvent.setup();
    mockFetch({ byEmployee: { [ALEX.id]: requests } });
    renderApp(<MyRequestsPage />, { route: "/requests", signedInAs: ALEX.id });

    await screen.findByRole("table");
    await user.click(filters().getByRole("button", { name: /Approved/ }));

    expect(table().getByText("Conference")).toBeInTheDocument();
    expect(table().queryByText("Family holiday")).not.toBeInTheDocument();
    expect(table().queryByText("Short notice trip")).not.toBeInTheDocument();
  });

  it("renders the same rows as cards for small screens", async () => {
    mockFetch({ byEmployee: { [ALEX.id]: requests } });
    renderApp(<MyRequestsPage />, { route: "/requests", signedInAs: ALEX.id });

    const cards = within(await screen.findByRole("list"));
    expect(cards.getAllByRole("listitem")).toHaveLength(3);
    expect(cards.getByText("Conference")).toBeInTheDocument();
  });

  it("explains an empty filter without claiming there are no requests at all", async () => {
    const user = userEvent.setup();
    mockFetch({ byEmployee: { [ALEX.id]: [requests[0]] } });
    renderApp(<MyRequestsPage />, { route: "/requests", signedInAs: ALEX.id });

    await screen.findByRole("table");
    await user.click(filters().getByRole("button", { name: /Rejected/ }));

    expect(screen.getByText("No rejected requests.")).toBeInTheDocument();
  });

  it("invites a first request when there are none", async () => {
    mockFetch({ byEmployee: { [ALEX.id]: [] } });
    renderApp(<MyRequestsPage />, { route: "/requests", signedInAs: ALEX.id });

    expect(await screen.findByText("You haven't requested any leave yet.")).toBeInTheDocument();
  });
});
