import type { ReactNode } from "react";

interface Props {
  label: string;
  value: ReactNode;
  hint?: string;
  /** Draws attention when the value represents something the user should act on. */
  emphasis?: boolean;
}

export function StatTile({ label, value, hint, emphasis = false }: Props) {
  return (
    // Fixed width while scrolling horizontally on phones; full width once the
    // parent becomes a grid.
    <div
      className="w-40 shrink-0 snap-start rounded-card border border-slate-200 bg-white px-4 py-3 shadow-card
        sm:w-auto sm:shrink sm:px-5 sm:py-4"
    >
      <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">{label}</p>
      <p className={`tabular mt-1.5 text-2xl font-semibold sm:mt-2 sm:text-3xl ${emphasis ? "text-brand-700" : "text-slate-900"}`}>
        {value}
      </p>
      {hint && <p className="mt-1 text-xs leading-snug text-slate-500">{hint}</p>}
    </div>
  );
}
