import { forwardRef } from "react";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

type Variant = "primary" | "secondary" | "destructive" | "ai";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  fullWidth?: boolean;
}

/**
 * Matches "3.1 Desktop design system > Controls": Primary action (purple),
 * Secondary, Destructive (red), AI assist (light purple). 44px control
 * height, 10px radius, minimum 40x40 interactive target (3.5.3).
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", fullWidth, className, disabled, children, ...props },
  ref
) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-[10px] px-4 text-[13.5px] font-semibold " +
    "transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50 h-11";

  const variants: Record<Variant, string> = {
    primary: "bg-[var(--cg-purple)] text-white hover:bg-[var(--cg-purple-hover)]",
    secondary:
      "bg-white text-[var(--cg-text-primary)] border border-[var(--cg-border-strong)] hover:bg-[var(--cg-surface)]",
    destructive: "bg-[var(--cg-red)] text-white hover:brightness-110",
    ai: "bg-[var(--cg-purple-soft)] text-[var(--cg-purple)] hover:brightness-95",
  };

  return (
    <button
      ref={ref}
      disabled={disabled}
      className={cn(base, variants[variant], fullWidth && "w-full", className)}
      {...props}
    >
      {children}
    </button>
  );
});
