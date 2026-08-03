import { useState } from "react";
import { Outlet } from "react-router-dom";
import { useIdentity } from "../../auth/IdentityContext";
import { Walkthrough } from "../../walkthrough/Walkthrough";
import { Button } from "../ui/Button";
import { AccountMenu } from "./AccountMenu";
import { Sidebar } from "./Sidebar";
import { MenuIcon } from "./icons";

export function AppLayout() {
  const [navOpen, setNavOpen] = useState(false);
  const { me, loading, error, retry } = useIdentity();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-slate-500">Loading…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6">
        <div className="text-center">
          <p className="text-sm text-rejected-text">Could not load employees. {error}</p>
          <p className="mt-1 text-xs text-slate-500">Check that the API is running on port 4000.</p>
          <div className="mt-4 flex justify-center">
            <Button onClick={retry}>Try again</Button>
          </div>
        </div>
      </div>
    );
  }

  // An unseeded database returns zero employees, so there is nobody to act as.
  // Pages below assume a resolved user, so stop here with something actionable.
  if (!me) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6">
        <div className="text-center">
          <p className="text-sm text-slate-700">No employees found.</p>
          <p className="mt-1 text-xs text-slate-500">
            Seed the database with <code className="font-mono">make docker-seed</code>, then reload.
          </p>
          <div className="mt-4 flex justify-center">
            <Button onClick={retry}>Reload</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Sidebar open={navOpen} onClose={() => setNavOpen(false)} />

      <div className="lg:pl-60">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-slate-200 bg-white px-4 sm:px-6">
          <button
            className="-ml-1 cursor-pointer rounded-control p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 lg:hidden"
            onClick={() => setNavOpen(true)}
            aria-label="Open navigation"
          >
            <MenuIcon className="h-5 w-5" />
          </button>
          <span className="text-sm font-semibold text-slate-900 lg:hidden">AscendX</span>
          <div className="ml-auto">
            <AccountMenu />
          </div>
        </header>

        <main className="px-4 py-6 sm:px-6 lg:px-8">
          <Outlet />
        </main>
      </div>

      <Walkthrough />
    </div>
  );
}
