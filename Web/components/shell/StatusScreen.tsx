import type { ReactNode } from "react";

interface StatusScreenProps {
  code: string;
  codeTone: "purple" | "amber" | "red";
  title: string;
  description: string;
  meta?: string;
  footnote?: string;
  children?: ReactNode;
}

const CODE_STYLES: Record<StatusScreenProps["codeTone"], string> = {
  purple: "border-[var(--cg-purple)]/30 text-[var(--cg-purple)]",
  amber: "border-[var(--cg-amber)]/30 text-[var(--cg-amber)]",
  red: "border-[var(--cg-red)]/30 text-[var(--cg-red)]",
};

/**
 * Shared shell for screens 24 (Access Denied), 26 (Page Not Found) and 27
 * (System Error). These are recovery/failure states, not authorization
 * decisions in themselves — copy never implies why access failed beyond
 * what the server already disclosed.
 */
export function StatusScreen({ code, codeTone, title, description, meta, footnote, children }: StatusScreenProps) {
  return (
    <div className="flex min-h-screen flex-col bg-[var(--cg-surface)]">
      <header className="flex items-center justify-between px-8 py-5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-[7px] bg-[var(--cg-purple)] text-[11px] font-bold text-white">
            CG
          </div>
          <span className="text-[13px] font-semibold text-[var(--cg-text-primary)]">CatalogGuard AI</span>
        </div>
        <span className="text-[11.5px] text-[var(--cg-text-muted)]">Secure workspace</span>
      </header>

      <main className="flex flex-1 items-center justify-center px-6">
        <div className="w-full max-w-[420px] rounded-[12px] border border-[var(--cg-border)] bg-white p-10 text-center">
          <div
            className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full border-2 text-[20px] font-bold ${CODE_STYLES[codeTone]}`}
          >
            {code}
          </div>
          <h1 className="mt-5 text-[19px] font-semibold text-[var(--cg-text-primary)]">{title}</h1>
          <p className="mt-2 text-[13.5px] text-[var(--cg-text-secondary)]">{description}</p>

          {meta ? (
            <p className="cg-mono mt-4 text-[11.5px] text-[var(--cg-text-muted)] border-t border-[var(--cg-border)] pt-4">
              {meta}
            </p>
          ) : (
            <div className="mt-4 border-t border-[var(--cg-border)] pt-4" />
          )}

          {children}

          {footnote ? <p className="mt-6 text-[11px] text-[var(--cg-text-muted)]">{footnote}</p> : null}
        </div>
      </main>
    </div>
  );
}
