"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AppShell } from "@/components/shell/AppShell";
import { TextField } from "@/components/ui/FormControls";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Alert } from "@/components/ui/Cards";
import { SessionExpiredOverlay } from "@/components/shell/SessionExpiredOverlay";
import { getMockSession } from "@/lib/fixtures/getSession";
import { isRole } from "@/lib/fixtures/getSession";
import { ROLE_LABEL } from "@/lib/types/session";
import type { Role } from "@/lib/types/session";

const TABS = ["Profile", "Security", "Sessions", "Notifications"] as const;

const SESSIONS = [
  { device: "Windows · Chrome", location: "Bengaluru", status: "current" as const },
  { device: "Chrome · Windows", location: "06 Aug · 09:21", status: "active" as const },
  { device: "Safari · iPhone", location: "04 Aug · 18:42", status: "expired" as const },
];

/**
 * Screen 23 — Profile & Security. Authenticated shared route.
 * `?role=` only selects which fixture session to preview in this Phase 1
 * build; a real session always determines this server-side once auth
 * exists (Web Backend Phase 1).
 */
export default function ProfileSecurityPage() {
  return (
    <Suspense fallback={null}>
      <ProfileSecurityContent />
    </Suspense>
  );
}

function ProfileSecurityContent() {
  const params = useSearchParams();
  const roleParam = params.get("role");
  const role: Role = isRole(roleParam) ? roleParam : "ADMIN";
  const user = getMockSession(role);

  const [tab, setTab] = useState<(typeof TABS)[number]>("Security");
  const [showExpired, setShowExpired] = useState(false);

  return (
    <AppShell
      user={user}
      breadcrumb={`Marketplace / ${ROLE_LABEL[role]}`}
      title="Profile & security"
      actions={<Button onClick={() => alert("Saved (demo only — no backend yet)")}>Save profile</Button>}
    >
      <p className="mb-5 text-[13px] text-[var(--cg-text-secondary)]">
        Manage identity, authentication safeguards and active sessions.
      </p>

      <div className="mb-5 flex items-center gap-6 border-b border-[var(--cg-border)]">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`-mb-px border-b-2 px-1 py-3 text-[13px] font-medium transition-colors ${
              tab === t
                ? "border-[var(--cg-purple)] text-[var(--cg-purple)]"
                : "border-transparent text-[var(--cg-text-muted)] hover:text-[var(--cg-text-secondary)]"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "Security" ? (
        <div className="grid grid-cols-[1fr_360px] gap-5">
          <div className="rounded-[12px] border border-[var(--cg-border)] bg-white p-6">
            <p className="text-[13px] font-semibold text-[var(--cg-text-primary)]">Account security</p>
            <p className="mb-4 text-[12px] text-[var(--cg-text-muted)]">
              {ROLE_LABEL[role]} · {user.sellerName ?? "Marketplace Operations"}
            </p>
            <div className="flex flex-col gap-4">
              <TextField label="Work email" defaultValue={user.email} readOnly />
              <TextField label="Current password" type="password" placeholder="••••••••••••" />
              <TextField
                label="New password"
                type="password"
                placeholder="••••••••••••"
                hint="At least 12 characters with mixed character classes."
              />
              <TextField label="Confirm new password" type="password" placeholder="••••••••••••" />
              <div>
                <Button onClick={() => alert("Password updated (demo only)")}>Update password</Button>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-5">
            <div className="rounded-[12px] border border-[var(--cg-border)] bg-white p-6">
              <p className="text-[13px] font-semibold text-[var(--cg-text-primary)]">Multi-factor authentication</p>
              <p className="mb-3 text-[12px] text-[var(--cg-text-muted)]">
                Required for administrators and catalog reviewers.
              </p>
              <StatusBadge tone={user.mfaEnabled ? "ready" : "warning"}>
                {user.mfaEnabled ? "Enabled" : "Not enabled"}
              </StatusBadge>
              <p className="mt-3 text-[12px] text-[var(--cg-text-secondary)]">
                Authenticator app configured · recovery codes generated 02 Jul 2026.
              </p>
              <Button variant="secondary" className="mt-4 w-full" onClick={() => setShowExpired(true)}>
                Regenerate codes
              </Button>
            </div>

            <div className="rounded-[12px] border border-[var(--cg-border)] bg-white p-6">
              <p className="mb-3 text-[13px] font-semibold text-[var(--cg-text-primary)]">Active sessions</p>
              <p className="mb-3 text-[12px] text-[var(--cg-text-muted)]">
                Revoke sessions you don&apos;t recognize.
              </p>
              <ul className="flex flex-col gap-3">
                {SESSIONS.map((s) => (
                  <li key={s.device} className="flex items-center justify-between text-[12.5px]">
                    <div>
                      <p className="font-medium text-[var(--cg-text-primary)]">{s.device}</p>
                      <p className="text-[11.5px] text-[var(--cg-text-muted)]">{s.location}</p>
                    </div>
                    <StatusBadge tone={s.status === "expired" ? "neutral" : "ready"}>
                      {s.status === "current" ? "Current" : s.status === "active" ? "Active" : "Expired"}
                    </StatusBadge>
                  </li>
                ))}
              </ul>
            </div>

            <Alert tone="warning" title="Security rule">
              Password or MFA changes revoke every other active session and write a USER audit event.
            </Alert>
          </div>
        </div>
      ) : (
        <div className="rounded-[12px] border border-dashed border-[var(--cg-border-strong)] bg-white p-10 text-center text-[13px] text-[var(--cg-text-muted)]">
          The {tab} tab is out of Phase 1 scope.
        </div>
      )}

      <div className="mt-6 flex justify-end">
        <button
          onClick={() => setShowExpired(true)}
          className="text-[12px] text-[var(--cg-text-muted)] underline decoration-dotted"
        >
          Preview session-expired state
        </button>
      </div>

      <SessionExpiredOverlay open={showExpired} onDiscard={() => setShowExpired(false)} />
    </AppShell>
  );
}
