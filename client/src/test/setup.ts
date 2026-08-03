import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach, vi } from "vitest";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

beforeEach(() => {
  localStorage.clear();
  // The walkthrough auto-opens on first visit; tests that want it opt in.
  localStorage.setItem("ascendx.tourSeen", "1");
});
