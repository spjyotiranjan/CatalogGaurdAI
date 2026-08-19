import Link from "next/link";

import { AuthSplitLayout } from "@/components/shell/AuthSplitLayout";
import { Alert } from "@/components/ui/Cards";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/FormControls";

/** This screen remains visible, but password-reset delivery has no backend implementation yet. */
export default function ResetPasswordPage() {
  return (
    <AuthSplitLayout>
      <h1 className="text-[22px] font-semibold text-[var(--cg-text-primary)]">Reset password</h1>
      <p className="mt-1 text-[13px] text-[var(--cg-text-secondary)]">
        Password-reset delivery has not been implemented yet.
      </p>

      <div className="mt-7 flex flex-col gap-4">
        <TextField label="Work email" type="email" autoComplete="email" placeholder="name@company.com" disabled />
        <Button type="button" fullWidth disabled>Password reset unavailable</Button>
        <Link href="/login" className="text-center text-[12.5px] font-semibold text-[var(--cg-purple)]">
          Return to sign in
        </Link>
        <Alert tone="warning" title="Not available yet">
          Password-reset requests are not connected to a backend service. Contact your marketplace administrator to regain access.
        </Alert>
      </div>

      <p className="mt-8 text-center text-[12px] text-[var(--cg-text-muted)]">
        Need access? Contact your marketplace administrator.
      </p>
    </AuthSplitLayout>
  );
}
