import type { LeaveStatus } from "../../api/client";

const STYLES: Record<LeaveStatus, { label: string; className: string; dot: string }> = {
  pending: {
    label: "Pending",
    className: "bg-pending-bg text-pending-text border-pending-border",
    dot: "bg-pending-text",
  },
  approved: {
    label: "Approved",
    className: "bg-approved-bg text-approved-text border-approved-border",
    dot: "bg-approved-text",
  },
  rejected: {
    label: "Rejected",
    className: "bg-rejected-bg text-rejected-text border-rejected-border",
    dot: "bg-rejected-text",
  },
};

export function StatusBadge({ status }: { status: LeaveStatus }) {
  const style = STYLES[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded border px-2 py-0.5 text-xs font-medium ${style.className}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} aria-hidden="true" />
      {style.label}
    </span>
  );
}
