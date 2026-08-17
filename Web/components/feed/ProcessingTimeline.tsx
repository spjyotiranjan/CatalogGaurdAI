import { STAGE_ORDER } from "@/lib/types/feed";
import type { StageKey } from "@/lib/types/feed";
import { cn } from "@/lib/utils/cn";

interface ProcessingTimelineProps {
  currentStage: StageKey;
  blocked?: boolean;
}

/**
 * Renders whatever stage the (fixture) backend last reported. Deliberately
 * does not animate or fill incrementally on a client timer — per
 * UI_DEVELOPMENT_PLAN.md Phase 2: "Do not simulate progress with timers."
 * The caller re-renders this with fresh data on poll/refresh instead.
 */
export function ProcessingTimeline({ currentStage, blocked }: ProcessingTimelineProps) {
  const currentIndex = STAGE_ORDER.findIndex((s) => s.key === currentStage);

  return (
    <div>
      <p className="mb-3 text-[12px] text-[var(--cg-text-muted)]">
        Deterministic validation runs before AI analysis.
      </p>
      <ol className="flex items-center" aria-label="Feed processing stages">
        {STAGE_ORDER.map((stage, idx) => {
          const done = idx < currentIndex;
          const active = idx === currentIndex;
          const isLast = idx === STAGE_ORDER.length - 1;
          return (
            <li key={stage.key} className="flex flex-1 items-center last:flex-none">
              <div className="flex flex-col items-center gap-1.5">
                <span
                  aria-current={active ? "step" : undefined}
                  className={cn(
                    "flex h-3.5 w-3.5 items-center justify-center rounded-full border-2",
                    active && blocked
                      ? "border-[var(--cg-red)] bg-[var(--cg-red)]"
                      : done || active
                        ? "border-[var(--cg-purple)] bg-[var(--cg-purple)]"
                        : "border-[var(--cg-border-strong)] bg-white"
                  )}
                />
                <span
                  className={cn(
                    "text-[11px]",
                    active ? "font-semibold text-[var(--cg-text-primary)]" : "text-[var(--cg-text-muted)]"
                  )}
                >
                  {stage.label}
                </span>
              </div>
              {!isLast ? (
                <span
                  aria-hidden="true"
                  className={cn("mx-1 h-px flex-1", done ? "bg-[var(--cg-purple)]" : "bg-[var(--cg-border)]")}
                />
              ) : null}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
