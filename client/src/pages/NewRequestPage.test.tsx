import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ALEX, makeRequest } from "../test/fixtures";
import { mockFetch, renderApp } from "../test/renderApp";
import { NewRequestPage } from "./NewRequestPage";

/** Date inputs don't accept keystrokes reliably; set the value directly. */
function setDate(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

describe("NewRequestPage", () => {
  beforeEach(() => localStorage.clear());

  it("submits the form and posts the entered values", async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn(() => makeRequest({ id: "new-1" }));
    mockFetch({ onCreate });
    renderApp(<NewRequestPage />, { route: "/requests/new", signedInAs: ALEX.id });

    await screen.findByLabelText("Start date");
    setDate("Start date", "2026-09-10");
    setDate("End date", "2026-09-14");
    await user.type(screen.getByLabelText("Reason"), "Family holiday");
    await user.click(screen.getByRole("button", { name: "Submit request" }));

    await waitFor(() =>
      expect(onCreate).toHaveBeenCalledWith({
        startDate: "2026-09-10",
        endDate: "2026-09-14",
        reason: "Family holiday",
      }),
    );
  });

  it("blocks an end date before the start date, without hitting the API", async () => {
    const onCreate = vi.fn();
    mockFetch({ onCreate });
    renderApp(<NewRequestPage />, { route: "/requests/new", signedInAs: ALEX.id });

    await screen.findByLabelText("Start date");
    setDate("Start date", "2026-09-14");
    setDate("End date", "2026-09-10");

    expect(await screen.findByText("End date cannot be before the start date.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Submit request" })).toBeDisabled();
    expect(onCreate).not.toHaveBeenCalled();
  });

  it("shows how many days the range covers", async () => {
    mockFetch({});
    renderApp(<NewRequestPage />, { route: "/requests/new", signedInAs: ALEX.id });

    await screen.findByLabelText("Start date");
    setDate("Start date", "2026-09-10");
    setDate("End date", "2026-09-14");

    expect(await screen.findByText("5 days of leave")).toBeInTheDocument();
  });

  it("counts a single-day request as one day", async () => {
    mockFetch({});
    renderApp(<NewRequestPage />, { route: "/requests/new", signedInAs: ALEX.id });

    await screen.findByLabelText("Start date");
    setDate("Start date", "2026-09-10");
    setDate("End date", "2026-09-10");

    expect(await screen.findByText("1 day of leave")).toBeInTheDocument();
  });

  it("stops a past date at the input, so it never reaches the API", async () => {
    // The date inputs carry min=today, so browser constraint validation blocks
    // submission before the server's own "cannot be fully in the past" check.
    const onCreate = vi.fn();
    mockFetch({ onCreate });
    renderApp(<NewRequestPage />, { route: "/requests/new", signedInAs: ALEX.id });

    const start = (await screen.findByLabelText("Start date")) as HTMLInputElement;
    setDate("Start date", "2020-01-01");

    expect(start.min).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(start.checkValidity()).toBe(false);
    expect(onCreate).not.toHaveBeenCalled();
  });

  it("reports a server-side rejection without losing what was typed", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = input.toString();
        if (url.startsWith("/employees")) {
          return { ok: true, status: 200, json: async () => ({ status: "success", message: "OK", data: [ALEX] }) } as Response;
        }
        if ((init?.method ?? "GET") === "POST") {
          return {
            ok: false,
            status: 500,
            json: async () => ({ status: "error", message: "Something went wrong.", data: null, code: "internal_error" }),
          } as Response;
        }
        return { ok: true, status: 200, json: async () => ({ status: "success", message: "OK", data: [] }) } as Response;
      }),
    );
    renderApp(<NewRequestPage />, { route: "/requests/new", signedInAs: ALEX.id });

    await screen.findByLabelText("Start date");
    setDate("Start date", "2099-01-01");
    setDate("End date", "2099-01-02");
    await user.type(screen.getByLabelText("Reason"), "Future trip");
    await user.click(screen.getByRole("button", { name: "Submit request" }));

    expect(await screen.findByText(/Something went wrong on our side/)).toBeInTheDocument();
    // The form keeps its contents so the request can be retried.
    expect(screen.getByLabelText("Reason")).toHaveValue("Future trip");
    expect(screen.getByRole("button", { name: "Submit request" })).toBeEnabled();
  });
});
