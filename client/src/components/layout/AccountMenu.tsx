import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useIdentity } from "../../auth/IdentityContext";
import { CheckIcon, ChevronDownIcon } from "./icons";

export function initials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

/**
 * Account menu and "sign in as" switcher in one. Auth is an `x-employee-id`
 * header, so picking a different employee *is* signing in as them — this makes
 * that read like a real account menu instead of a stray form control.
 */
export function AccountMenu() {
  const { me, employees, isManager, setMeId } = useIdentity();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  if (!me) return null;

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        data-tour="account"
        className="flex cursor-pointer items-center gap-2 rounded-control border border-slate-200 py-1 pr-2 pl-1 transition-colors hover:bg-slate-50"
      >
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-semibold text-brand-700">
          {initials(me.name)}
        </span>
        <span className="hidden text-left sm:block">
          <span className="block text-sm leading-tight font-medium text-slate-900">{me.name}</span>
          <span className="block text-[11px] leading-tight text-slate-500">{isManager ? "Manager" : "Employee"}</span>
        </span>
        <ChevronDownIcon className={`h-4 w-4 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-72 overflow-hidden rounded-card border border-slate-200 bg-white shadow-raised"
        >
          <div className="border-b border-slate-100 px-4 py-3">
            <p className="text-sm font-medium text-slate-900">{me.name}</p>
            <p className="mt-0.5 text-xs text-slate-500">
              {isManager ? "Manager" : "Employee"} · Team {me.teamId}
            </p>
            <Link
              to="/account"
              onClick={() => setOpen(false)}
              className="mt-2 inline-block cursor-pointer text-xs font-medium text-brand-700 hover:underline"
            >
              Account details and API id
            </Link>
          </div>

          <div className="px-4 pt-3 pb-1">
            <p className="text-[11px] font-medium tracking-wide text-slate-500 uppercase">Sign in as</p>
            <p className="mt-0.5 text-[11px] text-slate-400">Stands in for real login.</p>
          </div>

          <ul className="max-h-64 overflow-y-auto pb-2">
            {employees.map((employee) => {
              const active = employee.id === me.id;
              return (
                <li key={employee.id}>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setMeId(employee.id);
                      setOpen(false);
                    }}
                    className={`flex w-full cursor-pointer items-center gap-2.5 px-4 py-2 text-left text-sm hover:bg-slate-50 ${
                      active ? "text-brand-700" : "text-slate-700"
                    }`}
                  >
                    <span
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold ${
                        active ? "bg-brand-100 text-brand-700" : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {initials(employee.name)}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{employee.name}</span>
                    {employee.managerId === null && (
                      <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500">
                        Manager
                      </span>
                    )}
                    {active && <CheckIcon className="h-4 w-4 shrink-0" />}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
