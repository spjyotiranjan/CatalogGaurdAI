"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AuthSplitLayout } from "@/components/shell/AuthSplitLayout";
import { TextField, CheckboxField } from "@/components/ui/FormControls";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Cards";
import { ROLE_HOME } from "@/lib/types/session";
import type { Role } from "@/lib/types/session";

/**
 * Screen 01 — Sign In. Public route.
 *
 * UI-only per the Phase 1 boundary: this form does not authenticate anyone.
 * It exists to demonstrate the exact screen and to route to the fixture
 * dashboard matching the selected role, standing in for the real
 * "successful authentication opens the dashboard assigned to the active
 * role" behavior until Web Backend Phase 1 exists.
 */
export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("reviewer@marketplace.com");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function roleFromEmail(value: string): Role {
    if (value.includes("seller") || value.includes("northstar") || value.includes("retail")) {
      return "SELLER_OPERATOR";
    }
    if (value.includes("admin") || value.startsWith("sp@")) {
      return "ADMIN";
    }
    return "CATALOG_REVIEWER";
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!email || !password) {
      setError("Enter your work email and password to continue.");
      return;
    }
    setSubmitting(true);
    const role = roleFromEmail(email.toLowerCase());
    window.setTimeout(() => {
      setSubmitting(false);
      router.push(ROLE_HOME[role]);
    }, 400);
  }

  return (
    <AuthSplitLayout>
      <h1 className="text-[22px] font-semibold text-[var(--cg-text-primary)]">Welcome back</h1>
      <p className="mt-1 text-[13px] text-[var(--cg-text-secondary)]">
        Sign in to your assigned seller, reviewer or administrator workspace.
      </p>

      <form className="mt-7 flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
        <TextField
          label="Work email"
          type="email"
          autoComplete="username"
          placeholder="reviewer@marketplace.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <TextField
          label="Password"
          type="password"
          autoComplete="current-password"
          placeholder="••••••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        {error ? (
          <p role="alert" className="text-[12.5px] text-[var(--cg-red)]">
            {error}
          </p>
        ) : null}

        <div className="flex items-center justify-between">
          <CheckboxField label="Keep me signed in on this device" />
          <Link href="/reset-password" className="text-[12.5px] font-medium text-[var(--cg-purple)]">
            Forgot password?
          </Link>
        </div>

        <Button type="submit" fullWidth disabled={submitting}>
          {submitting ? "Signing in…" : "Sign in"}
        </Button>

        <p className="text-center text-[11.5px] text-[var(--cg-text-muted)]">
          Role-based access is assigned by an administrator
        </p>

        <Alert
          tone="info"
          title="Protected access"
        >
          Authentication, active-user checks, tenant isolation and role authorization run on every
          protected request.
        </Alert>
      </form>

      <p className="mt-8 text-center text-[12px] text-[var(--cg-text-muted)]">
        Need access? Contact your marketplace administrator.
      </p>

      <p className="mt-4 text-center text-[11px] text-[var(--cg-text-muted)]">
        Demo only — try an email containing &quot;seller&quot; or &quot;admin&quot; to preview that
        workspace, any password.
      </p>
    </AuthSplitLayout>
  );
}
