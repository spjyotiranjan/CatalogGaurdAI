"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_BY_ROLE, ROLE_RAIL_GROUP } from "@/lib/types/session";
import type { SessionUser } from "@/lib/types/session";
import { NavIcon } from "@/components/shell/NavIcon";
import { cn } from "@/lib/utils/cn";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return (parts[0]?.[0] ?? "").concat(parts[1]?.[0] ?? "").toUpperCase();
}

/**
 * 244px dark navigation rail (3.5.2). Navigation items are rendered from
 * the server-confirmed role only — this is presentation, never the
 * authorization boundary. Every route it links to must still enforce role
 * and tenant scope on the server once the backend exists.
 */
export function RoleNav({ user }: { user: SessionUser }) {
  const pathname = usePathname();
  const items = NAV_BY_ROLE[user.role];

  return (
    <nav
      aria-label="Primary"
      style={{ width: "var(--cg-rail-width)" }}
      className="flex h-full flex-shrink-0 flex-col bg-[var(--cg-ink)] text-[var(--cg-text-on-ink)]"
    >
      <div className="flex items-center gap-2.5 px-5 pt-6 pb-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-[8px] bg-[var(--cg-purple)] text-[13px] font-bold text-white">
          CG
        </div>
        <div className="leading-tight">
          <p className="text-[13.5px] font-semibold text-white">CatalogGuard</p>
          <p className="text-[10.5px] tracking-wide text-[var(--cg-text-on-ink-muted)]">AI</p>
        </div>
      </div>

      <p className="px-5 pb-3 text-[10.5px] font-semibold uppercase tracking-wider text-[var(--cg-purple)]">
        {ROLE_RAIL_GROUP[user.role]}
      </p>

      <ul className="flex flex-1 flex-col gap-0.5 px-3">
        {items.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-10 items-center gap-3 rounded-[10px] px-3 text-[13px] transition-colors",
                  active
                    ? "bg-[var(--cg-purple)] font-semibold text-white"
                    : "text-[var(--cg-text-on-ink-muted)] hover:bg-white/5 hover:text-white"
                )}
              >
                <NavIcon name={item.icon} />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>

      <div className="mx-3 mb-3 flex items-center gap-3 rounded-[10px] bg-white/5 px-3 py-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--cg-purple)] text-[11px] font-bold text-white">
          {initials(user.name)}
        </div>
        <div className="min-w-0 leading-tight">
          <p className="truncate text-[12.5px] font-medium text-white">{user.name}</p>
          <p className="truncate text-[11px] text-[var(--cg-text-on-ink-muted)]">
            {user.sellerName ?? "Marketplace Operations"}
          </p>
        </div>
      </div>

      <p className="border-t border-white/10 px-5 py-3 text-[10px] font-semibold uppercase tracking-wider text-[var(--cg-text-on-ink-muted)]">
        Catalog quality gate
      </p>
    </nav>
  );
}
