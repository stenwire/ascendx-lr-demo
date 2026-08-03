import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "danger" | "ghost";
type Size = "sm" | "md";

const VARIANTS: Record<Variant, string> = {
  // brand-700, not brand-500: #00BCFF with white text fails contrast.
  primary: "bg-brand-700 text-white border-brand-700 hover:bg-brand-600 hover:border-brand-600",
  secondary: "bg-white text-slate-700 border-slate-300 hover:bg-slate-50",
  danger: "bg-white text-rejected-text border-rejected-border hover:bg-rejected-bg",
  ghost: "bg-transparent text-slate-600 border-transparent hover:bg-slate-100",
};

const SIZES: Record<Size, string> = {
  sm: "h-8 px-3 text-xs",
  md: "h-9 px-4 text-sm",
};

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  children: ReactNode;
}

export function Button({ variant = "secondary", size = "md", className = "", children, ...rest }: Props) {
  return (
    <button
      className={`inline-flex cursor-pointer items-center justify-center gap-2 rounded-control border font-medium
        transition-colors disabled:cursor-not-allowed disabled:opacity-50
        ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
