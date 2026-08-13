import { cn } from "@/lib/utils/cn";

export type StatusTone =
  | "ready"
  | "in-review"
  | "warning"
  | "blocked"
  | "system"
  | "ai-advisory"
  | "neutral";

const TONE_STYLES: Record<StatusTone, string> = {
  ready: "bg-[var(--cg-green-soft)] text-[var(--cg-green)]",
  "in-review": "bg-[var(--cg-purple-soft)] text-[var(--cg-purple)]",
  warning: "bg-[var(--cg-amber-soft)] text-[var(--cg-amber)]",
  blocked: "bg-[var(--cg-red-soft)] text-[var(--cg-red)]",
  system: "bg-[var(--cg-blue-soft)] text-[var(--cg-blue)]",
  "ai-advisory": "bg-[var(--cg-teal-soft)] text-[var(--cg-teal)]",
  neutral: "bg-[var(--cg-surface)] text-[var(--cg-text-secondary)] border border-[var(--cg-border)]",
};

const TONE_DOT: Record<StatusTone, string> = {
  ready: "bg-[var(--cg-green)]",
  "in-review": "bg-[var(--cg-purple)]",
  warning: "bg-[var(--cg-amber)]",
  blocked: "bg-[var(--cg-red)]",
  system: "bg-[var(--cg-blue)]",
  "ai-advisory": "bg-[var(--cg-teal)]",
  neutral: "bg-[var(--cg-text-muted)]",
};

interface StatusBadgeProps {
  tone: StatusTone;
  children: React.ReactNode;
  className?: string;
}

/**
 * Status uses text plus color, never color alone (3.5.12). Severity/state
 * pills communicate meaning through both the label copy and the tone.
 */
export function StatusBadge({ tone, children, className }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-semibold",
        TONE_STYLES[tone],
        className
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", TONE_DOT[tone])} aria-hidden="true" />
      {children}
    </span>
  );
}
