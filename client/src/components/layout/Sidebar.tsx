import { NavLink } from "react-router-dom";
import { useIdentity } from "../../auth/IdentityContext";
import {
  AccountIcon,
  ApprovalsIcon,
  CloseIcon,
  HelpIcon,
  OverviewIcon,
  RequestsIcon,
  TeamIcon,
} from "./icons";

interface NavItem {
  to: string;
  label: string;
  Icon: (props: { className?: string }) => JSX.Element;
  managerOnly?: boolean;
  tour?: string;
}

const PRIMARY_NAV: NavItem[] = [
  { to: "/", label: "Overview", Icon: OverviewIcon },
  { to: "/requests", label: "My requests", Icon: RequestsIcon },
  { to: "/approvals", label: "Approvals", Icon: ApprovalsIcon, managerOnly: true },
  { to: "/team", label: "Team", Icon: TeamIcon, managerOnly: true },
];

const SECONDARY_NAV: NavItem[] = [
  { to: "/account", label: "Account", Icon: AccountIcon },
  { to: "/help", label: "How it works", Icon: HelpIcon, tour: "help-link" },
];

function NavItemLink({ item, onNavigate }: { item: NavItem; onNavigate: () => void }) {
  const { to, label, Icon, tour } = item;
  return (
    <NavLink
      to={to}
      end={to === "/"}
      onClick={onNavigate}
      data-tour={tour}
      className={({ isActive }) =>
        `relative flex cursor-pointer items-center gap-3 rounded-control px-3 py-2 text-sm transition-colors ${
          isActive ? "bg-ink-950 font-medium text-white" : "text-slate-400 hover:bg-ink-700 hover:text-white"
        }`
      }
    >
      {({ isActive }) => (
        <>
          {isActive && (
            <span className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-brand-500" aria-hidden="true" />
          )}
          <Icon className={`h-4 w-4 ${isActive ? "text-brand-500" : ""}`} />
          {label}
        </>
      )}
    </NavLink>
  );
}

export function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { isManager } = useIdentity();
  const primary = PRIMARY_NAV.filter((item) => !item.managerOnly || isManager);

  return (
    <>
      {open && <div className="fixed inset-0 z-30 bg-slate-900/40 lg:hidden" onClick={onClose} aria-hidden="true" />}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-60 flex-col bg-ink-900 transition-transform
          lg:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-ink-800 px-5">
          <div className="flex items-center gap-2.5">
            <span className="h-5 w-5 rounded bg-brand-500" aria-hidden="true" />
            <span className="text-sm font-semibold text-white">AscendX</span>
          </div>
          <button
            className="cursor-pointer text-slate-400 hover:text-white lg:hidden"
            onClick={onClose}
            aria-label="Close navigation"
          >
            <CloseIcon />
          </button>
        </div>

        <nav data-tour="nav" className="flex-1 overflow-y-auto px-3 py-4">
          <div className="space-y-1">
            {primary.map((item) => (
              <NavItemLink key={item.to} item={item} onNavigate={onClose} />
            ))}
          </div>

          <div className="my-4 border-t border-ink-800" />

          <div className="space-y-1">
            {SECONDARY_NAV.map((item) => (
              <NavItemLink key={item.to} item={item} onNavigate={onClose} />
            ))}
          </div>
        </nav>

        <p className="shrink-0 border-t border-ink-800 px-5 py-3 font-mono text-[11px] text-slate-500">
          Leave management
        </p>
      </aside>
    </>
  );
}
