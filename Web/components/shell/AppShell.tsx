import type { ReactNode } from "react";
import type { SessionUser } from "@/lib/types/session";
import { RoleNav } from "@/components/shell/RoleNav";
import { TopBar } from "@/components/shell/TopBar";

interface AppShellProps {
  user: SessionUser;
  breadcrumb: string;
  title: string;
  children: ReactNode;
  actions?: ReactNode;
}

/**
 * Shared desktop shell used by every authenticated route (3.5.2). Preserves
 * the 244px rail / 72px top bar / 8px grid layout across seller, reviewer
 * and admin screens. Usable from 1280px upward; not adapted for mobile
 * (3.5.3 — a separate design pass is required before that work begins).
 */
export function AppShell({ user, breadcrumb, title, children, actions }: AppShellProps) {
  return (
    <div className="flex h-screen min-w-[1280px] overflow-hidden bg-[var(--cg-surface)]">
      <RoleNav user={user} />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar breadcrumb={breadcrumb} title={title} user={user} />
        <main className="flex-1 overflow-y-auto px-8 py-6">
          {actions ? <div className="mb-5 flex items-center justify-end gap-2">{actions}</div> : null}
          {children}
        </main>
      </div>
    </div>
  );
}
