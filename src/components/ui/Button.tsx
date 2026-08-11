import type { ButtonHTMLAttributes, ReactNode } from "react";

const styles = {
  primary:
    "border border-accent bg-accent text-white hover:border-accent-hover hover:bg-accent-hover",
  secondary:
    "border border-transparent bg-surface-muted text-foreground hover:border-accent hover:bg-border/60",
  ghost:
    "border border-transparent bg-transparent text-muted hover:border-accent hover:bg-surface-muted hover:text-foreground",
  danger:
    "border border-danger/25 bg-danger/10 text-danger hover:border-danger hover:bg-danger hover:text-white",
} as const;

export function Button({
  children,
  variant = "secondary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  variant?: keyof typeof styles;
}) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${styles[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
