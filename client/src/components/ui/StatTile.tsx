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
    <div className="rounded-card border border-slate-200 bg-white px-5 py-4 shadow-card">
      <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">{label}</p>
      <p className={`tabular mt-2 text-3xl font-semibold ${emphasis ? "text-brand-700" : "text-slate-900"}`}>{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}
