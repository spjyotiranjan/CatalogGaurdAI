"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/shell/AppShell";
import { Dropzone } from "@/components/feed/Dropzone";
import { SelectField } from "@/components/ui/FormControls";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Cards";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useToast } from "@/components/ui/LiveRegion";
import { getMockSession } from "@/lib/fixtures/getSession";
import { preflightFile, submitFeedUpload } from "@/lib/fixtures/feeds";
import { FEED_TYPE_LABEL } from "@/lib/types/feed";
import type { FeedType, UploadPreflightResult } from "@/lib/types/feed";

const FEED_TYPE_OPTIONS = (Object.keys(FEED_TYPE_LABEL) as FeedType[]).map((v) => ({
  value: v,
  label: FEED_TYPE_LABEL[v],
}));

const CURRENCY_OPTIONS = [
  { value: "INR", label: "INR · Indian Rupee" },
  { value: "USD", label: "USD · US Dollar" },
  { value: "AED", label: "AED · UAE Dirham" },
];

const TIMEZONE_OPTIONS = [
  { value: "Asia/Calcutta", label: "Asia/Calcutta" },
  { value: "Asia/Dubai", label: "Asia/Dubai" },
  { value: "UTC", label: "UTC" },
];

type SubmitState =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "duplicate"; message: string; existingFeedId: string }
  | { kind: "error"; message: string; correlationId: string };

/**
 * Screen 04 — Upload Feed.
 *
 * D-002 note: this UI accepts CSV only. The Implementation Design
 * screenshot text ("CSV, XLSX or JSON") conflicts with the recorded
 * architecture decision; the decision wins per docs/README.md precedence
 * rule. Flagged in the Phase 2 handoff — do not silently re-widen this
 * without an updated ARCHITECTURE_DECISIONS.md entry.
 */
export default function UploadFeedPage() {
  const user = getMockSession("SELLER_OPERATOR");
  const router = useRouter();
  const { announce } = useToast();

  const [file, setFile] = useState<File | null>(null);
  const [preflight, setPreflight] = useState<UploadPreflightResult | null>(null);
  const [feedType, setFeedType] = useState<FeedType>("FULL_CATALOG");
  const [currency, setCurrency] = useState("INR");
  const [timezone, setTimezone] = useState("Asia/Calcutta");
  const [submitState, setSubmitState] = useState<SubmitState>({ kind: "idle" });

  // Regenerated per selected file so a double-click can't create two feeds.
  const idempotencyKey = useMemo(
    () => (file ? `${file.name}-${file.size}-${file.lastModified}` : null),
    [file]
  );

  function handleFile(selected: File) {
    setFile(selected);
    setSubmitState({ kind: "idle" });
    setPreflight(preflightFile({ name: selected.name, size: selected.size }));
  }

  async function handleSubmit() {
    if (!file || !preflight?.ok || submitState.kind === "submitting") return;
    setSubmitState({ kind: "submitting" });

    const result = await submitFeedUpload({
      fileName: file.name,
      sizeBytes: file.size,
      feedType,
    });

    if (result.ok) {
      announce("Feed accepted and queued for processing.", "success");
      router.push(`/seller/feeds/${result.feedId}`);
      return;
    }

    if (result.reason === "DUPLICATE") {
      setSubmitState({ kind: "duplicate", message: result.message, existingFeedId: result.existingFeedId });
      return;
    }

    setSubmitState({ kind: "error", message: result.message, correlationId: result.correlationId });
  }

  const canSubmit = Boolean(file && preflight?.ok && submitState.kind !== "submitting");

  return (
    <AppShell
      user={user}
      breadcrumb="Marketplace / Seller"
      title="Upload feed"
      actions={
        <Button variant="secondary" onClick={() => router.push("/seller/feeds")}>
          View feed history
        </Button>
      }
    >
      <p className="mb-5 text-[13px] text-[var(--cg-text-secondary)]">
        Submit a versioned seller catalog for validation and review.
      </p>

      <div className="mb-6 rounded-[12px] border border-[var(--cg-border)] bg-white p-5">
        <ol className="flex items-center gap-2 text-[11.5px] text-[var(--cg-text-muted)]" aria-label="Upload steps">
          {["Select file", "Configure", "Upload", "Validate"].map((step, i) => (
            <li key={step} className="flex items-center gap-2">
              <span
                className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold ${
                  i === 0 || (i === 1 && file)
                    ? "bg-[var(--cg-purple)] text-white"
                    : "border border-[var(--cg-border-strong)] text-[var(--cg-text-muted)]"
                }`}
              >
                {i + 1}
              </span>
              {step}
              {i < 3 ? <span className="mx-1 h-px w-6 bg-[var(--cg-border)]" aria-hidden="true" /> : null}
            </li>
          ))}
        </ol>
      </div>

      <div className="grid grid-cols-[1fr_360px] gap-5">
        <div className="rounded-[12px] border border-[var(--cg-border)] bg-white p-6">
          <p className="mb-3 text-[13px] font-semibold text-[var(--cg-text-primary)]">Upload product feed</p>
          <Dropzone onFileSelected={handleFile} disabled={submitState.kind === "submitting"} />

          {file ? (
            <div className="mt-4 flex items-center justify-between rounded-[10px] border border-[var(--cg-border)] px-4 py-3">
              <div>
                <p className="text-[13px] font-medium text-[var(--cg-text-primary)]">{file.name}</p>
                <p className="cg-mono text-[11.5px] text-[var(--cg-text-muted)]">
                  {(file.size / (1024 * 1024)).toFixed(1)} MB
                </p>
              </div>
              <StatusBadge tone={preflight?.ok ? "ready" : "blocked"}>
                {preflight?.ok ? "Selected" : "Rejected"}
              </StatusBadge>
            </div>
          ) : null}

          {preflight && !preflight.ok ? (
            <div className="mt-4">
              <Alert tone="danger" title="File rejected">
                {preflight.message}
              </Alert>
            </div>
          ) : null}

          {submitState.kind === "duplicate" ? (
            <div className="mt-4">
              <Alert
                tone="warning"
                title="Duplicate upload"
                action={
                  <Button
                    variant="secondary"
                    onClick={() => router.push(`/seller/feeds/${submitState.existingFeedId}`)}
                  >
                    View existing feed
                  </Button>
                }
              >
                {submitState.message}
              </Alert>
            </div>
          ) : null}

          {submitState.kind === "error" ? (
            <div className="mt-4">
              <Alert tone="danger" title="Upload failed">
                {submitState.message}
                <p className="cg-mono mt-1 text-[11px] text-[var(--cg-text-muted)]">
                  Reference: {submitState.correlationId}
                </p>
              </Alert>
            </div>
          ) : null}
        </div>

        <div className="flex flex-col gap-5">
          <div className="rounded-[12px] border border-[var(--cg-border)] bg-white p-6">
            <p className="mb-1 text-[13px] font-semibold text-[var(--cg-text-primary)]">Feed configuration</p>
            <p className="mb-4 text-[12px] text-[var(--cg-text-muted)]">Applied before the upload is committed.</p>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <span className="text-[13px] font-medium text-[var(--cg-text-secondary)]">Seller</span>
                <div className="flex h-11 items-center rounded-[10px] border border-[var(--cg-border)] bg-[var(--cg-surface)] px-3.5 text-[14px] text-[var(--cg-text-primary)]">
                  {user.sellerName}
                </div>
              </div>
              <SelectField
                label="Feed type"
                options={FEED_TYPE_OPTIONS}
                value={feedType}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFeedType(e.target.value as FeedType)}
              />
              <div className="grid grid-cols-2 gap-3">
                <SelectField
                  label="Currency"
                  options={CURRENCY_OPTIONS}
                  value={currency}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setCurrency(e.target.value)}
                />
                <SelectField
                  label="Timezone"
                  options={TIMEZONE_OPTIONS}
                  value={timezone}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setTimezone(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-2 text-[12px] text-[var(--cg-text-secondary)]">
                <StatusBadge tone="ready">Checksum + seller scope</StatusBadge>
                Duplicate upload protection
              </div>
            </div>
          </div>

          <div className="rounded-[12px] border border-[var(--cg-border)] bg-white p-6">
            <p className="mb-2 text-[13px] font-semibold text-[var(--cg-text-primary)]">Before upload</p>
            <ul className="flex flex-col gap-1.5 text-[12px] text-[var(--cg-text-secondary)]">
              <li>The original file is stored immutably. Validation begins only after the database commit.</li>
              <li>A stable idempotency key prevents duplicate submissions.</li>
              <li>Mapping, validation and review use a shared correlation ID.</li>
            </ul>
            <Button fullWidth className="mt-4" disabled={!canSubmit} onClick={handleSubmit}>
              {submitState.kind === "submitting" ? "Uploading…" : "Upload feed"}
            </Button>
            {idempotencyKey ? (
              <p className="cg-mono mt-2 text-center text-[10.5px] text-[var(--cg-text-muted)]">
                Idempotency key ready
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
