import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/Button";

export interface MetricCardData {
  label: string;
  value: string;
  delta?: string;
  tone?: "neutral" | "positive" | "warning" | "negative";
}

const TONE_ACCENT: Record<NonNullable<MetricCardData["tone"]>, string> = {
  neutral: "var(--cg-purple)",
  positive: "var(--cg-green)",
  warning: "var(--cg-amber)",
  negative: "var(--cg-red)",
};

export function MetricCard({ label, value, delta, tone = "neutral" }: MetricCardData) {
  return (
    <div className="rounded-[12px] border border-[var(--cg-border)] bg-white p-5">
      <div className="flex items-start gap-3">
        <span
          className="mt-1 h-full w-[3px] self-stretch rounded-full"
          style={{ backgroundColor: TONE_ACCENT[tone] }}
          aria-hidden="true"
        />
        <div>
          <p className="text-[22px] font-semibold leading-none text-[var(--cg-text-primary)]">{value}</p>
          <p className="mt-2 text-[13px] text-[var(--cg-text-secondary)]">{label}</p>
          {delta ? <p className="mt-0.5 text-[12px] text-[var(--cg-text-muted)]">{delta}</p> : null}
        </div>
      </div>
    </div>
  );
}

interface AlertProps {
  tone?: "info" | "warning" | "danger" | "success";
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}

const ALERT_STYLES: Record<NonNullable<AlertProps["tone"]>, string> = {
  info: "border-[var(--cg-blue)]/30 bg-[var(--cg-blue-soft)] text-[var(--cg-text-primary)]",
  warning: "border-[var(--cg-amber)]/30 bg-[var(--cg-amber-soft)] text-[var(--cg-text-primary)]",
  danger: "border-[var(--cg-red)]/30 bg-[var(--cg-red-soft)] text-[var(--cg-text-primary)]",
  success: "border-[var(--cg-green)]/30 bg-[var(--cg-green-soft)] text-[var(--cg-text-primary)]",
};

export function Alert({ tone = "info", title, children, action }: AlertProps) {
  return (
    <div role="alert" className={cn("rounded-[12px] border p-4", ALERT_STYLES[tone])}>
      <p className="text-[13.5px] font-semibold">{title}</p>
      {children ? <div className="mt-1 text-[13px] text-[var(--cg-text-secondary)]">{children}</div> : null}
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}

interface EmptyStateProps {
  title: string;
  description?: string;
  primaryAction?: { label: string; onClick?: () => void };
  secondaryAction?: { label: string; onClick?: () => void };
  meta?: string;
}

/** Empty states explain why nothing is present and offer a useful next action (3.5.4). */
export function EmptyState({ title, description, primaryAction, secondaryAction, meta }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-[12px] border border-[var(--cg-border)] bg-white px-8 py-16 text-center">
      <div
        className="flex h-12 w-12 items-center justify-center rounded-full"
        style={{ backgroundColor: "var(--cg-green-soft)" }}
        aria-hidden="true"
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <path d="M4 10h12M10 4v12" stroke="var(--cg-green)" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </div>
      <h3 className="text-[15px] font-semibold text-[var(--cg-text-primary)]">{title}</h3>
      {description ? <p className="max-w-sm text-[13px] text-[var(--cg-text-secondary)]">{description}</p> : null}
      {(primaryAction || secondaryAction) && (
        <div className="mt-2 flex items-center gap-2">
          {secondaryAction ? (
            <Button variant="secondary" onClick={secondaryAction.onClick}>
              {secondaryAction.label}
            </Button>
          ) : null}
          {primaryAction ? <Button onClick={primaryAction.onClick}>{primaryAction.label}</Button> : null}
        </div>
      )}
      {meta ? <p className="mt-2 text-[11.5px] text-[var(--cg-text-muted)]">{meta}</p> : null}
    </div>
  );
}

interface ErrorStateProps {
  title: string;
  description?: string;
  correlationId?: string;
  onRetry?: () => void;
}

/**
 * Region-level recoverable error: names the failed operation, states
 * whether a mutation occurred, and shows a reference ID (3.5.4).
 */
export function ErrorState({ title, description, correlationId, onRetry }: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-[12px] border border-[var(--cg-red)]/25 bg-[var(--cg-red-soft)] px-8 py-12 text-center">
      <h3 className="text-[15px] font-semibold text-[var(--cg-text-primary)]">{title}</h3>
      {description ? <p className="max-w-sm text-[13px] text-[var(--cg-text-secondary)]">{description}</p> : null}
      {correlationId ? <p className="cg-mono text-[11.5px] text-[var(--cg-text-muted)]">Reference: {correlationId}</p> : null}
      {onRetry ? (
        <Button variant="secondary" onClick={onRetry} className="mt-1">
          Try again
        </Button>
      ) : null}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-[var(--cg-border)]", className)}
      aria-hidden="true"
    />
  );
}

/** Structure-matching skeleton for a metric card region while a count loads (3.5.4). */
export function MetricCardSkeleton() {
  return (
    <div className="rounded-[12px] border border-[var(--cg-border)] bg-white p-5">
      <Skeleton className="h-6 w-16" />
      <Skeleton className="mt-3 h-3.5 w-24" />
      <Skeleton className="mt-2 h-3 w-20" />
    </div>
  );
}
