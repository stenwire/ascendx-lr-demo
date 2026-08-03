import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

const FIELD_BASE =
  "w-full rounded-control border border-slate-300 bg-white px-3 text-sm text-slate-900 " +
  "placeholder:text-slate-400 focus:border-brand-500 disabled:cursor-not-allowed " +
  "disabled:bg-slate-50 disabled:text-slate-400";

export function FormField({
  label,
  htmlFor,
  hint,
  error,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium text-slate-700">
        {label}
      </label>
      {children}
      {error ? (
        <p className="mt-1.5 text-xs text-rejected-text">{error}</p>
      ) : (
        hint && <p className="mt-1.5 text-xs text-slate-500">{hint}</p>
      )}
    </div>
  );
}

export function TextInput({ className = "", ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`${FIELD_BASE} h-9 ${className}`} {...rest} />;
}

export function TextArea({ className = "", ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`${FIELD_BASE} py-2 ${className}`} {...rest} />;
}

export function Select({ className = "", children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={`${FIELD_BASE} h-9 cursor-pointer ${className}`} {...rest}>
      {children}
    </select>
  );
}
