import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { App } from "../App";
import { ALEX, BO, MANAGER, makeRequest } from "../test/fixtures";
import { mockFetch } from "../test/renderApp";

const alexRequest = makeRequest({ id: "req-alex", employeeId: ALEX.id, reason: "Alex holiday" });
const boRequest = makeRequest({ id: "req-bo", employeeId: BO.id, reason: "Bo moving house" });

function setup(route: string, signedInAs: string) {
  localStorage.setItem("ascendx.employeeId", signedInAs);
  window.history.pushState({}, "", route);
  mockFetch({
    pending: [],
    byId: { [alexRequest.id]: alexRequest, [boRequest.id]: boRequest },
    byEmployee: { [ALEX.id]: [alexRequest], [BO.id]: [boRequest], [MANAGER.id]: [] },
  });
  render(<App />);
}

async function switchTo(name: RegExp, from: RegExp) {
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: from }));
  await user.click(await screen.findByRole("menuitem", { name }));
}

describe("switching employee while viewing one record", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("ascendx.tourSeen", "1");
  });

  it("leaves the record behind instead of showing it to the new employee", async () => {
    setup(`/requests/${alexRequest.id}`, ALEX.id);

    // Alex's own request, opened by Alex.
    expect(await screen.findByText("Alex holiday")).toBeInTheDocument();

    await switchTo(/Bo Idris/, /Alex Chen/);

    // The id in the URL belonged to Alex, so it must not still be on screen.
    await waitFor(() => expect(window.location.pathname).toBe("/requests"));
    await waitFor(() => expect(screen.queryAllByText("Alex holiday")).toHaveLength(0));
    expect(await screen.findAllByText("Bo moving house")).not.toHaveLength(0);
  });

  it("stays put when the employee has not changed", async () => {
    const user = userEvent.setup();
    setup(`/requests/${alexRequest.id}`, ALEX.id);
    await screen.findByText("Alex holiday");

    // Re-select the same person: not a switch, so nothing should move.
    await user.click(await screen.findByRole("button", { name: /Alex Chen/ }));
    await user.click(await screen.findByRole("menuitem", { name: /Alex Chen/ }));

    await waitFor(() => expect(window.location.pathname).toBe(`/requests/${alexRequest.id}`));
    expect(screen.getByText("Alex holiday")).toBeInTheDocument();
  });

  it("does not disturb a collection route", async () => {
    setup("/requests", ALEX.id);
    expect(await screen.findAllByText("Alex holiday")).not.toHaveLength(0);

    await switchTo(/Bo Idris/, /Alex Chen/);

    // Already a collection; the list simply reloads for Bo.
    await waitFor(() => expect(window.location.pathname).toBe("/requests"));
    expect(await screen.findAllByText("Bo moving house")).not.toHaveLength(0);
  });

  it("does not treat the new-request form as a record", async () => {
    setup("/requests/new", ALEX.id);
    await screen.findByLabelText("Start date");

    await switchTo(/Bo Idris/, /Alex Chen/);

    // /requests/new is a form, not someone's record — it stays open.
    await waitFor(() => expect(screen.getByRole("button", { name: /Bo Idris/ })).toBeInTheDocument());
    expect(window.location.pathname).toBe("/requests/new");
  });

  it("leaves the overview alone", async () => {
    setup("/", ALEX.id);
    expect(await screen.findByRole("heading", { name: "Welcome, Alex" })).toBeInTheDocument();

    await switchTo(/Bo Idris/, /Alex Chen/);

    expect(await screen.findByRole("heading", { name: "Welcome, Bo" })).toBeInTheDocument();
    expect(window.location.pathname).toBe("/");
  });
});
