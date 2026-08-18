"use client";

import { useState } from "react";

import { AppShell } from "@/components/shell/AppShell";
import { Alert } from "@/components/ui/Cards";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/FormControls";
import { useToast } from "@/components/ui/LiveRegion";
import { AccountClientError, changeCurrentPassword } from "@/lib/client/account";
import type { SessionUser } from "@/lib/types/session";

type PasswordFields = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

const initialPasswordFields: PasswordFields = {
  currentPassword: "",
  newPassword: "",
  confirmPassword: "",
};

export function ProfileSecurityClient({ user }: { user: SessionUser }) {
  const { announce } = useToast();
  const [fields, setFields] = useState(initialPasswordFields);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [requestError, setRequestError] = useState<string | null>(null);
  const [referenceId, setReferenceId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function updateField(field: keyof PasswordFields, value: string) {
    setFields((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => ({ ...current, [field]: "" }));
  }

  async function updatePassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setRequestError(null);
    setReferenceId(null);

    if (fields.newPassword !== fields.confirmPassword) {
      setFieldErrors({ confirmPassword: "New password and confirmation must match." });
      return;
    }

    setSubmitting(true);
    try {
      await changeCurrentPassword({
        currentPassword: fields.currentPassword,
        newPassword: fields.newPassword,
      });

      setFields(initialPasswordFields);
      announce("Password updated.", "success");
    } catch (error) {
      if (error instanceof AccountClientError) {
        const errors = error.envelope?.error.fieldErrors;
        setFieldErrors(
          Object.fromEntries(
            Object.entries(errors ?? {}).map(([field, messages]) => [field, messages[0] ?? "Invalid value."]),
          ),
        );
        setRequestError(error.message);
        setReferenceId(error.envelope?.error.correlationId ?? null);
        return;
      }
      setRequestError("Password could not be updated because the service is unavailable. No changes were made.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AppShell user={user} breadcrumb="Marketplace / Account" title="Profile & security">
      <p className="mb-5 text-[13px] text-[var(--cg-text-secondary)]">
        Review your account details and change your password.
      </p>

      <div className="grid grid-cols-[minmax(0,1fr)_360px] gap-5">
        <form className="rounded-[12px] border border-[var(--cg-border)] bg-white p-6" onSubmit={updatePassword} noValidate>
          <p className="text-[13px] font-semibold text-[var(--cg-text-primary)]">Account security</p>
          <p className="mb-4 text-[12px] text-[var(--cg-text-muted)]">
            {user.email} · {user.sellerName ?? "Marketplace Operations"}
          </p>
          <div className="flex flex-col gap-4">
            <TextField label="Work email" value={user.email} readOnly />
            <TextField label="Current password" type="password" autoComplete="current-password" value={fields.currentPassword} onChange={(event) => updateField("currentPassword", event.target.value)} error={fieldErrors.currentPassword} />
            <TextField label="New password" type="password" autoComplete="new-password" value={fields.newPassword} onChange={(event) => updateField("newPassword", event.target.value)} error={fieldErrors.newPassword} hint="At least 12 characters with uppercase, lowercase, number and symbol." />
            <TextField label="Confirm new password" type="password" autoComplete="new-password" value={fields.confirmPassword} onChange={(event) => updateField("confirmPassword", event.target.value)} error={fieldErrors.confirmPassword} />
            <div>
              <Button type="submit" disabled={submitting}>{submitting ? "Updating password…" : "Update password"}</Button>
            </div>
          </div>
        </form>

        <div className="flex flex-col gap-5">
          {requestError ? (
            <Alert tone="danger" title="Password update failed">
              {requestError}
              {referenceId ? <span className="mt-2 block cg-mono text-[11.5px]">Reference: {referenceId}</span> : null}
            </Alert>
          ) : null}
          <Alert tone="info" title="Available account controls">
            Password changes are available now. Multi-factor authentication, recovery codes, and active-session
            management are not available in this release.
          </Alert>
        </div>
      </div>
    </AppShell>
  );
}
