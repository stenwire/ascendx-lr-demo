import type { ReactNode } from "react";
import { Button } from "./Button";

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-slate-200 ${className}`} />;
}

export function TableSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3 px-5 py-4">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-9 w-full" />
      ))}
    </div>
  );
}

export function EmptyState({ message, action }: { message: string; action?: ReactNode }) {
  return (
    <div className="px-5 py-12 text-center">
      <p className="text-sm text-slate-500">{message}</p>
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="px-5 py-10 text-center">
      <p className="text-sm text-rejected-text">{message}</p>
      {onRetry && (
        <div className="mt-4 flex justify-center">
          <Button size="sm" onClick={onRetry}>
            Try again
          </Button>
        </div>
      )}
    </div>
  );
}

type Tone = "warning" | "error" | "info";

const TONES: Record<Tone, string> = {
  warning: "border-pending-border bg-pending-bg text-pending-text",
  error: "border-rejected-border bg-rejected-bg text-rejected-text",
  info: "border-brand-200 bg-brand-50 text-brand-900",
};

export function Alert({
  tone = "info",
  title,
  children,
  action,
}: {
  tone?: Tone;
  title?: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className={`rounded-control border px-4 py-3 ${TONES[tone]}`}>
      {title && <p className="text-sm font-semibold">{title}</p>}
      <div className={`text-sm ${title ? "mt-1" : ""}`}>{children}</div>
      {action && <div className="mt-3 flex gap-2">{action}</div>}
    </div>
  );
}
