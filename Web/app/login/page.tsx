"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn, signOut } from "next-auth/react";

import { AuthSplitLayout } from "@/components/shell/AuthSplitLayout";
import { Alert } from "@/components/ui/Cards";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/FormControls";
import { AccessRequestModal } from "@/components/access/AccessRequestModal";
import { fetchCurrentAccount } from "@/lib/client/account";
import { ROLE_HOME } from "@/lib/types/session";

/** Authenticates through Auth.js and redirects from the BFF-confirmed account role. */
function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isAdministratorLogin = searchParams.get("returnTo") === "admin-access-requests";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requestRole, setRequestRole] = useState<"SELLER_OPERATOR" | "CATALOG_REVIEWER" | null>(null);

  async function clearAuthenticatedSession(): Promise<void> {
    await signOut({ redirect: false }).catch(() => undefined);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!email || !password) {
      setError("Enter your work email and password to continue.");
      return;
    }

    setSubmitting(true);
    let sessionCreated = false;
    try {
      const result = await signIn("credentials", { email, password, redirect: false });
      if (!result?.ok || result.error) {
        setError("The email or password is incorrect, or this account is unavailable.");
        return;
      }
      sessionCreated = true;

      const account = await fetchCurrentAccount();
      if (isAdministratorLogin && account.data.role !== "ADMIN") {
        await clearAuthenticatedSession();
        sessionCreated = false;
        setError("This sign-in is reserved for platform administrators. Use the standard sign-in page for your workspace.");
        return;
      }
      if (!isAdministratorLogin && account.data.role === "ADMIN") {
        await clearAuthenticatedSession();
        sessionCreated = false;
        setError("Administrator accounts must sign in through the administrator portal.");
        return;
      }

      const destination =
        account.data.role === "ADMIN" && isAdministratorLogin
          ? "/admin/access-requests"
          : ROLE_HOME[account.data.role];
      router.replace(destination);
      router.refresh();
    } catch {
      if (sessionCreated) {
        await clearAuthenticatedSession();
      }
      setError("We could not complete sign-in. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthSplitLayout>
      <h1 className="text-[22px] font-semibold text-[var(--cg-text-primary)]">
        {isAdministratorLogin ? "Administrator sign in" : "Welcome back"}
      </h1>
      <p className="mt-1 text-[13px] text-[var(--cg-text-secondary)]">
        {isAdministratorLogin
          ? "Sign in to review seller and reviewer access requests."
          : "Sign in to your assigned seller or reviewer workspace."}
      </p>

      <form className="mt-7 flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
        <TextField label="Work email" type="email" autoComplete="username" placeholder="name@company.com" value={email} onChange={(event) => setEmail(event.target.value)} />
        <TextField label="Password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} />

        {error ? <p role="alert" className="text-[12.5px] text-[var(--cg-red)]">{error}</p> : null}

        <div className="flex justify-end">
          <Link href="/reset-password" className="text-[12.5px] font-medium text-[var(--cg-purple)]">
            Forgot password?
          </Link>
        </div>

        <Button type="submit" fullWidth disabled={submitting}>
          {submitting ? "Signing in…" : "Sign in"}
        </Button>

        <p className="text-center text-[11.5px] text-[var(--cg-text-muted)]">
          {isAdministratorLogin
            ? "Administrator access is granted through secure provisioning."
            : "Role-based access is assigned by an administrator."}
        </p>

        <Alert tone="info" title={isAdministratorLogin ? "Administrator access" : "Protected access"}>
          {isAdministratorLogin
            ? "Only active platform administrators can review and decide access requests."
            : "Authentication, active-user checks, tenant isolation and role authorization run on every protected request."}
        </Alert>
      </form>

      {isAdministratorLogin ? (
        <Link href="/login" className="mt-8 block text-center text-[12.5px] font-semibold text-[var(--cg-purple)]">
          Join as reviewer or seller
        </Link>
      ) : (
        <>
          <p className="mt-8 text-center text-[12px] text-[var(--cg-text-muted)]">
            Need access? Contact your marketplace administrator.
          </p>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <Button variant="secondary" type="button" onClick={() => setRequestRole("SELLER_OPERATOR")}>Join as seller</Button>
            <Button variant="secondary" type="button" onClick={() => setRequestRole("CATALOG_REVIEWER")}>Join as reviewer</Button>
          </div>
          <Link
            href="/admin/access-requests"
            className="mt-4 block text-center text-[12.5px] font-semibold text-[var(--cg-purple)]"
          >
            Administrator portal
          </Link>
          <p className="mt-1 text-center text-[11px] text-[var(--cg-text-muted)]">
            Administrators sign in here to review access requests.
          </p>
        </>
      )}
      {requestRole ? <AccessRequestModal role={requestRole} open onClose={() => setRequestRole(null)} /> : null}
    </AuthSplitLayout>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={(
        <AuthSplitLayout>
          <h1 className="text-[22px] font-semibold text-[var(--cg-text-primary)]">Loading sign in...</h1>
          <p className="mt-1 text-[13px] text-[var(--cg-text-secondary)]">
            Preparing the secure authentication form.
          </p>
        </AuthSplitLayout>
      )}
    >
      <LoginPageContent />
    </Suspense>
  );
}
