import { useEffect, useState } from "react";
import { CheckIcon, CopyIcon } from "../layout/icons";

/** Monospace value with a copy button — for ids and commands people paste elsewhere. */
export function CopyField({ value, label, multiline = false }: { value: string; label: string; multiline?: boolean }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
    } catch {
      // Clipboard is unavailable over plain http on some browsers; the value is
      // selectable on screen either way.
      setCopied(false);
    }
  }

  return (
    <div className="flex items-stretch gap-2">
      <code
        className={`min-w-0 flex-1 rounded-control border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-700 ${
          multiline ? "break-all whitespace-pre-wrap" : "truncate"
        }`}
      >
        {value}
      </code>
      <button
        type="button"
        onClick={copy}
        aria-label={`Copy ${label}`}
        className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-control border border-slate-300 bg-white px-3 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50"
      >
        {copied ? <CheckIcon className="h-3.5 w-3.5 text-approved-text" /> : <CopyIcon className="h-3.5 w-3.5" />}
        <span className="hidden sm:inline">{copied ? "Copied" : "Copy"}</span>
      </button>
    </div>
  );
}
