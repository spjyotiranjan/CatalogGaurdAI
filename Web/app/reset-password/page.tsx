"use client";

import { useState } from "react";
import Link from "next/link";
import { AuthSplitLayout } from "@/components/shell/AuthSplitLayout";
import { TextField } from "@/components/ui/FormControls";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Cards";

/**
 * Screen 02 — Reset Password. Public route. Requests a short-lived,
 * one-use reset link without revealing account existence — so the
 * confirmation state is identical regardless of whether the email matches
 * an account.
 */
export default function ResetPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setSent(true);
  }

  return (
    <AuthSplitLayout>
      <h1 className="text-[22px] font-semibold text-[var(--cg-text-primary)]">Reset password</h1>
      <p className="mt-1 text-[13px] text-[var(--cg-text-secondary)]">
        Enter your account email. We&apos;ll send a secure password-reset link if the account is active.
      </p>

      {sent ? (
        <div className="mt-7">
          <Alert tone="success" title="Check your inbox">
            If {email} matches an active account, a reset link is on its way. Links expire after 20
            minutes and can be used once.
          </Alert>
          <Link
            href="/login"
            className="mt-5 block text-center text-[12.5px] font-semibold text-[var(--cg-purple)]"
          >
            Return to sign in
          </Link>
        </div>
      ) : (
        <form className="mt-7 flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
          <TextField
            label="Work email"
            type="email"
            autoComplete="email"
            placeholder="name@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <Button type="submit" fullWidth>
            Send reset link
          </Button>

          <Link href="/login" className="text-center text-[12.5px] font-semibold text-[var(--cg-purple)]">
            Return to sign in
          </Link>

          <Alert tone="info" title="Security note">
            Reset links expire after 20 minutes and can be used only once.
          </Alert>
        </form>
      )}

      <p className="mt-8 text-center text-[12px] text-[var(--cg-text-muted)]">
        Need access? Contact your marketplace administrator.
      </p>
    </AuthSplitLayout>
  );
}
