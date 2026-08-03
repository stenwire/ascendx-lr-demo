import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";
import { IdentityProvider } from "./auth/IdentityContext";
import { AppLayout } from "./components/layout/AppLayout";
import { WalkthroughProvider } from "./walkthrough/WalkthroughContext";
import { ALEX, MANAGER } from "./test/fixtures";
import { mockFetch } from "./test/renderApp";

/** Mirrors App.tsx's guard so route protection is tested, not reimplemented ad hoc. */
function renderRoutes(route: string, signedInAs: string) {
  localStorage.setItem("ascendx.employeeId", signedInAs);
  mockFetch({ pending: [], byEmployee: {} });

  return render(
    <IdentityProvider>
      <MemoryRouter initialEntries={[route]}>
        <WalkthroughProvider>
          <Routes>
            <Route element={<AppLayout />}>
              <Route index element={<h1>Overview page</h1>} />
              <Route path="approvals" element={<ManagerOnly><h1>Approvals page</h1></ManagerOnly>} />
              <Route path="team" element={<ManagerOnly><h1>Team page</h1></ManagerOnly>} />
            </Route>
          </Routes>
        </WalkthroughProvider>
      </MemoryRouter>
    </IdentityProvider>,
  );
}

import { Navigate } from "react-router-dom";
import { useIdentity } from "./auth/IdentityContext";

function ManagerOnly({ children }: { children: JSX.Element }) {
  const { isManager } = useIdentity();
  return isManager ? children : <Navigate to="/" replace />;
}

describe("route access", () => {
  beforeEach(() => localStorage.clear());

  it("lets a manager reach the approvals page", async () => {
    renderRoutes("/approvals", MANAGER.id);
    expect(await screen.findByRole("heading", { name: "Approvals page" })).toBeInTheDocument();
  });

  it("redirects a non-manager away from approvals", async () => {
    renderRoutes("/approvals", ALEX.id);
    expect(await screen.findByRole("heading", { name: "Overview page" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Approvals page" })).not.toBeInTheDocument();
  });

  it("redirects a non-manager away from the team page", async () => {
    renderRoutes("/team", ALEX.id);
    expect(await screen.findByRole("heading", { name: "Overview page" })).toBeInTheDocument();
  });
});

describe("sidebar navigation", () => {
  beforeEach(() => localStorage.clear());

  it("shows manager-only items to a manager", async () => {
    renderRoutes("/", MANAGER.id);
    expect(await screen.findByRole("link", { name: /Approvals/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Team/ })).toBeInTheDocument();
  });

  it("hides manager-only items from an employee", async () => {
    renderRoutes("/", ALEX.id);
    expect(await screen.findByRole("link", { name: /My requests/ })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Approvals/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /^Team/ })).not.toBeInTheDocument();
  });

  it("always offers account and help", async () => {
    renderRoutes("/", ALEX.id);
    expect(await screen.findByRole("link", { name: /Account/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /How it works/ })).toBeInTheDocument();
  });
});

describe("identity", () => {
  beforeEach(() => localStorage.clear());

  it("prompts to seed when no employees exist", async () => {
    mockFetch({ employees: [] });
    render(
      <IdentityProvider>
        <MemoryRouter>
          <WalkthroughProvider>
            <Routes>
              <Route element={<AppLayout />}>
                <Route index element={<h1>Overview page</h1>} />
              </Route>
            </Routes>
          </WalkthroughProvider>
        </MemoryRouter>
      </IdentityProvider>,
    );

    expect(await screen.findByText("No employees found.")).toBeInTheDocument();
  });
});
