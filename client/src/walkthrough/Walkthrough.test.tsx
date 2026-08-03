import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Route, Routes } from "react-router-dom";
import { ALEX } from "../test/fixtures";
import { mockFetch, renderApp } from "../test/renderApp";
import { Walkthrough } from "./Walkthrough";
import { useWalkthrough } from "./WalkthroughContext";

function Harness() {
  const { start, active } = useWalkthrough();
  const [navOpen, setNavOpen] = useState(false);
  return (
    <>
      <button onClick={start}>Replay walkthrough</button>
      <span data-testid="state">{active ? "open" : "closed"}</span>
      <span data-testid="nav-open">{navOpen ? "nav-open" : "nav-closed"}</span>
      {/* Stands in for the sidebar drawer, off-canvas until asked to open. */}
      <nav data-tour="nav" style={{ position: "fixed", left: navOpen ? 0 : -240, width: 240, height: 400 }}>
        <a data-tour="help-link" href="/help">
          How it works
        </a>
      </nav>
      <Walkthrough navOpen={navOpen} onNavOpenChange={setNavOpen} />
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

  describe("on a narrow screen", () => {
    /** jsdom reports no media-query support by default; force the mobile answer. */
    function setViewport(desktop: boolean) {
      vi.stubGlobal("matchMedia", (query: string) => ({
        matches: query.includes("min-width: 1024px") ? desktop : !desktop,
        media: query,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        onchange: null,
        dispatchEvent: () => false,
      }));
    }

    it("opens the navigation drawer for steps that point into it", async () => {
      setViewport(false);
      const user = userEvent.setup();
      renderTour();
      await user.click(await screen.findByRole("button", { name: "Replay walkthrough" }));

      // Step 1 is the intro and needs nothing open.
      expect(screen.getByTestId("nav-open")).toHaveTextContent("nav-closed");

      // Step 2 highlights the navigation, which is off-canvas until opened.
      await user.click(screen.getByRole("button", { name: "Next" }));
      await waitFor(() => expect(screen.getByTestId("nav-open")).toHaveTextContent("nav-open"));
    });

    it("closes the drawer again once the tour moves on", async () => {
      setViewport(false);
      const user = userEvent.setup();
      renderTour();
      await user.click(await screen.findByRole("button", { name: "Replay walkthrough" }));
      await user.click(screen.getByRole("button", { name: "Next" }));
      await waitFor(() => expect(screen.getByTestId("nav-open")).toHaveTextContent("nav-open"));

      // Step 3 targets the account menu in the top bar, so the drawer is not needed.
      await user.click(screen.getByRole("button", { name: "Next" }));
      await waitFor(() => expect(screen.getByTestId("nav-open")).toHaveTextContent("nav-closed"));
    });

    it("closes the drawer when the tour is dismissed", async () => {
      setViewport(false);
      const user = userEvent.setup();
      renderTour();
      await user.click(await screen.findByRole("button", { name: "Replay walkthrough" }));
      await user.click(screen.getByRole("button", { name: "Next" }));
      await waitFor(() => expect(screen.getByTestId("nav-open")).toHaveTextContent("nav-open"));

      await user.keyboard("{Escape}");
      await waitFor(() => expect(screen.getByTestId("nav-open")).toHaveTextContent("nav-closed"));
    });

    it("leaves the drawer alone on a desktop viewport", async () => {
      setViewport(true);
      const user = userEvent.setup();
      renderTour();
      await user.click(await screen.findByRole("button", { name: "Replay walkthrough" }));
      await user.click(screen.getByRole("button", { name: "Next" }));

      // The sidebar is permanently visible at this width; nothing to open.
      await waitFor(() => expect(screen.getByText("2 of 4")).toBeInTheDocument());
      expect(screen.getByTestId("nav-open")).toHaveTextContent("nav-closed");
    });
  });

  it("can be skipped from the first step", async () => {
    const user = userEvent.setup();
    renderTour();
    await user.click(await screen.findByRole("button", { name: "Replay walkthrough" }));

    await user.click(screen.getByRole("button", { name: "Skip" }));
    await waitFor(() => expect(screen.getByTestId("state")).toHaveTextContent("closed"));
  });
});
