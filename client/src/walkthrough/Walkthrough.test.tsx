import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { Route, Routes } from "react-router-dom";
import { ALEX } from "../test/fixtures";
import { mockFetch, renderApp } from "../test/renderApp";
import { Walkthrough } from "./Walkthrough";
import { useWalkthrough } from "./WalkthroughContext";

function Harness() {
  const { start, active } = useWalkthrough();
  return (
    <>
      <button onClick={start}>Replay walkthrough</button>
      <span data-testid="state">{active ? "open" : "closed"}</span>
      <Walkthrough />
    </>
  );
}

function renderTour({ seen = true }: { seen?: boolean } = {}) {
  mockFetch({});
  if (!seen) localStorage.removeItem("ascendx.tourSeen");
  return renderApp(
    <Routes>
      <Route path="*" element={<Harness />} />
    </Routes>,
    { route: "/", signedInAs: ALEX.id },
  );
}

describe("Walkthrough", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("ascendx.tourSeen", "1");
  });

  it("stays closed once it has been seen", async () => {
    renderTour();
    await screen.findByRole("button", { name: "Replay walkthrough" });
    expect(screen.getByTestId("state")).toHaveTextContent("closed");
  });

  it("opens automatically on a first visit and records that it ran", async () => {
    renderTour({ seen: false });
    expect(await screen.findByRole("dialog", { name: "Product walkthrough" })).toBeInTheDocument();
    await waitFor(() => expect(localStorage.getItem("ascendx.tourSeen")).toBe("1"));
  });

  it("can be replayed on demand", async () => {
    const user = userEvent.setup();
    renderTour();

    await user.click(await screen.findByRole("button", { name: "Replay walkthrough" }));
    expect(screen.getByRole("dialog", { name: "Product walkthrough" })).toBeInTheDocument();
    expect(screen.getByText("A quick tour")).toBeInTheDocument();
  });

  it("steps forward and back", async () => {
    const user = userEvent.setup();
    renderTour();
    await user.click(await screen.findByRole("button", { name: "Replay walkthrough" }));

    expect(screen.getByText("1 of 4")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByText("2 of 4")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByText("1 of 4")).toBeInTheDocument();
  });

  it("drops manager-only steps for an employee", async () => {
    // Six steps exist; two are manager-only, so Alex sees four.
    const user = userEvent.setup();
    renderTour();
    await user.click(await screen.findByRole("button", { name: "Replay walkthrough" }));
    expect(screen.getByText("1 of 4")).toBeInTheDocument();
  });

  it("closes on Escape", async () => {
    const user = userEvent.setup();
    renderTour();
    await user.click(await screen.findByRole("button", { name: "Replay walkthrough" }));

    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.getByTestId("state")).toHaveTextContent("closed"));
  });

  it("advances with the arrow keys", async () => {
    const user = userEvent.setup();
    renderTour();
    await user.click(await screen.findByRole("button", { name: "Replay walkthrough" }));

    await user.keyboard("{ArrowRight}");
    await waitFor(() => expect(screen.getByText("2 of 4")).toBeInTheDocument());
    await user.keyboard("{ArrowLeft}");
    await waitFor(() => expect(screen.getByText("1 of 4")).toBeInTheDocument());
  });

  it("can be skipped from the first step", async () => {
    const user = userEvent.setup();
    renderTour();
    await user.click(await screen.findByRole("button", { name: "Replay walkthrough" }));

    await user.click(screen.getByRole("button", { name: "Skip" }));
    await waitFor(() => expect(screen.getByTestId("state")).toHaveTextContent("closed"));
  });
});
