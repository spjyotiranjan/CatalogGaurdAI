"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/FormControls";
import { useToast } from "@/components/ui/LiveRegion";
import { errorEnvelopeSchema } from "@/lib/contracts/errors";
import { cn } from "@/lib/utils/cn";

type Message = { tone: "error" | "success"; text: string };
type FieldErrors = Record<string, string[]>;

function firstFieldError(fieldErrors: FieldErrors, field: string): string | undefined {
  return fieldErrors[field]?.[0];
}

export function AccessRequestModal({ role, open, onClose }: { role: "SELLER_OPERATOR" | "CATALOG_REVIEWER"; open: boolean; onClose: () => void }) {
  const seller = role === "SELLER_OPERATOR";
  const [message, setMessage] = useState<Message | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const { announce } = useToast();

  function clearFieldError(field: string) {
    setFieldErrors((current) => {
      if (!current[field]) return current;
      return Object.fromEntries(
        Object.entries(current).filter(([name]) => name !== field),
      );
    });
  }

  function clearChangedFieldError(event: React.FormEvent<HTMLFormElement>) {
    const target = event.target;
    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
      clearFieldError(target.name);
    }
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    setMessage(null); setFieldErrors({}); setSubmitting(true);
    const form = new FormData(formElement);
    const response = await fetch("/api/access-requests", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ role, fullName: form.get("fullName"), email: form.get("email"), password: form.get("password"), proposal: form.get("proposal"), businessName: form.get("businessName") || undefined, contactPhone: form.get("contactPhone") || undefined }) }).catch(() => null);
    if (!response?.ok) {
      const parsed = errorEnvelopeSchema.safeParse(await response?.json().catch(() => null));
      const errors = parsed.success ? parsed.data.error.fieldErrors ?? {} : {};
      setFieldErrors(errors);
      setMessage({
        tone: "error",
        text: Object.keys(errors).length > 0
          ? "Please correct the highlighted fields and try again."
          : parsed.success
            ? parsed.data.error.message
            : "Your request could not be submitted. Please try again.",
      });
      setSubmitting(false);
      return;
    }
    formElement.reset();
    setSubmitting(false);
    onClose();
    announce("Request submitted. An administrator must approve it before you can sign in.", "success");
  }
  return <Modal open={open} onClose={onClose} titleId="access-request-title" title={seller ? "Apply to join as a seller" : "Apply to join as a reviewer"} footer={<Button variant="secondary" onClick={onClose}>Close</Button>}>
    <p className="mb-4">Your application is reviewed by a marketplace administrator. Your credentials stay inactive until approved.</p>
    <form onSubmit={submit} onChange={clearChangedFieldError} className="flex max-h-[65vh] flex-col gap-3 overflow-y-auto pr-1" noValidate>
      <TextField name="fullName" label="Full name" error={firstFieldError(fieldErrors, "fullName")} required />
      <TextField name="email" label="Work email" type="email" error={firstFieldError(fieldErrors, "email")} required />
      <TextField name="password" label="Choose a password" type="password" autoComplete="new-password" error={firstFieldError(fieldErrors, "password")} hint="At least 12 characters with uppercase, lowercase, number and symbol." required />
      {seller ? <><TextField name="businessName" label="Business name" error={firstFieldError(fieldErrors, "businessName")} required /><TextField name="contactPhone" label="Contact phone" error={firstFieldError(fieldErrors, "contactPhone")} /></> : null}
      <label className="flex flex-col gap-1.5 text-[13px] font-medium text-[var(--cg-text-secondary)]" htmlFor="access-request-proposal">
        {seller ? "Seller proposal" : "Reviewer proposal"}
        <textarea id="access-request-proposal" name="proposal" required minLength={20} rows={4} aria-invalid={Boolean(firstFieldError(fieldErrors, "proposal"))} aria-describedby={firstFieldError(fieldErrors, "proposal") ? "access-request-proposal-error" : undefined} className={cn("rounded-[10px] border bg-white px-3.5 py-2.5 text-[14px] text-[var(--cg-text-primary)] outline-none", firstFieldError(fieldErrors, "proposal") ? "border-[var(--cg-red)] focus:border-[var(--cg-red)]" : "border-[var(--cg-border-strong)] focus:border-[var(--cg-purple)]")} placeholder={seller ? "Tell us about your catalog and business." : "Tell us about your catalog-review experience."} />
        {firstFieldError(fieldErrors, "proposal") ? <p id="access-request-proposal-error" className="text-[12.5px] font-normal text-[var(--cg-red)]">{firstFieldError(fieldErrors, "proposal")}</p> : null}
      </label>
      {message ? <p role={message.tone === "error" ? "alert" : "status"} className={cn("text-[12.5px]", message.tone === "error" ? "text-[var(--cg-red)]" : "text-[var(--cg-green)]")}>{message.text}</p> : null}
      <div className="sticky bottom-0 z-10 bg-white pt-1">
        <Button type="submit" fullWidth className="h-14 text-[14px]" disabled={submitting}>{submitting ? "Submitting…" : "Submit request"}</Button>
      </div>
    </form>
  </Modal>;
}
