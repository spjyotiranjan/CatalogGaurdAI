import type { SessionUser } from "@/lib/types/session";
import { ROLE_LABEL } from "@/lib/types/session";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return (parts[0]?.[0] ?? "").concat(parts[1]?.[0] ?? "").toUpperCase();
}

interface TopBarProps {
  breadcrumb: string;
  title: string;
  user: SessionUser;
}

/** 72px top bar (3.5.2), consistent across every authenticated desktop screen. */
export function TopBar({ breadcrumb, title, user }: TopBarProps) {
  return (
    <header
      style={{ height: "var(--cg-topbar-height)" }}
      className="flex flex-shrink-0 items-center justify-between border-b border-[var(--cg-border)] bg-white px-8"
    >
      <div className="leading-tight">
        <p className="text-[11.5px] text-[var(--cg-text-muted)]">{breadcrumb}</p>
        <h1 className="text-[16px] font-semibold text-[var(--cg-text-primary)]">{title}</h1>
      </div>

      <div className="flex items-center gap-4">
        <span className="flex items-center gap-1.5 text-[12px] text-[var(--cg-text-secondary)]">
          <span className="h-2 w-2 rounded-full bg-[var(--cg-green)]" aria-hidden="true" />
          All systems
        </span>
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--cg-surface)] text-[11px] font-semibold text-[var(--cg-text-secondary)]">
          3
        </span>
        <div className="flex items-center gap-2 rounded-full border border-[var(--cg-border)] py-1 pl-1 pr-3">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--cg-purple-soft)] text-[10.5px] font-bold text-[var(--cg-purple)]">
            {initials(user.name)}
          </span>
          <span className="text-[12px] font-medium text-[var(--cg-text-secondary)]">
            {ROLE_LABEL[user.role]}
          </span>
        </div>
      </div>
    </header>
  );
}
