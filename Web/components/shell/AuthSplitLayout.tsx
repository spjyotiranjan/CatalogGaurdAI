import type { ReactNode } from "react";

const CHECKLIST = [
  "Deterministic rules run before AI",
  "AI suggestions include confidence and evidence",
  "Only authorized reviewers approve products",
  "Every USER, SYSTEM and AI action is audited",
];

/**
 * Matches screens 01 (Sign In) and 02 (Reset Password): dark ink panel with
 * marketing copy + trust checklist on the left, white form panel on the
 * right. Public route — no session, role, or auth check belongs here.
 */
export function AuthSplitLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen w-full">
      <aside className="hidden w-[420px] flex-shrink-0 flex-col justify-between bg-[var(--cg-ink)] px-10 py-10 text-[var(--cg-text-on-ink)] md:flex">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-[8px] bg-[var(--cg-purple)] text-[13px] font-bold text-white">
              CG
            </div>
            <div className="leading-tight">
              <p className="text-[13.5px] font-semibold text-white">CatalogGuard AI</p>
              <p className="text-[10px] uppercase tracking-wide text-[var(--cg-text-on-ink-muted)]">
                Pre-publish catalog quality
              </p>
            </div>
          </div>

          <h2 className="mt-12 text-[28px] font-semibold leading-tight text-white">
            Catch inconsistent product data before customers do.
          </h2>
          <p className="mt-3 text-[13.5px] leading-relaxed text-[var(--cg-text-on-ink-muted)]">
            A validation workspace for seller feeds, catalog corrections, human review and controlled
            publication readiness.
          </p>

          <ul className="mt-9 flex flex-col gap-4">
            {CHECKLIST.map((item) => (
              <li key={item} className="flex items-start gap-3 text-[13px] text-[var(--cg-text-on-ink-muted)]">
                <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-[var(--cg-purple)]">
                  <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                    <path d="M2.5 6.2 5 8.7l4.5-5" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                <span className="text-white/90">{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="text-[12px] text-[var(--cg-text-on-ink-muted)]">
          Catalog quality is a controlled workflow, not a cleanup task.
        </p>
      </aside>

      <main className="flex flex-1 items-center justify-center bg-[var(--cg-surface)] px-6 py-10">
        <div className="w-full max-w-[380px]">{children}</div>
      </main>
    </div>
  );
}
