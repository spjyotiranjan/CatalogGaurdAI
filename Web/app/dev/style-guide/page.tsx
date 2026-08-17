"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { TextField, CheckboxField } from "@/components/ui/FormControls";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { MetricCard, Alert, EmptyState, ErrorState, MetricCardSkeleton } from "@/components/ui/Cards";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/LiveRegion";

const STATUS_TONES = [
  { tone: "ready" as const, label: "Ready" },
  { tone: "in-review" as const, label: "In review" },
  { tone: "warning" as const, label: "Warning" },
  { tone: "blocked" as const, label: "Blocked" },
  { tone: "system" as const, label: "System" },
  { tone: "ai-advisory" as const, label: "AI advisory" },
];

/**
 * /dev/style-guide — internal-only visual QA surface for the Phase 1
 * shared component family. Not part of the role-based route inventory;
 * exists so keyboard operation, focus visibility and status text+color
 * treatment can be reviewed together (3.5.12) without full Storybook.
 */
export default function StyleGuidePage() {
  const [modalOpen, setModalOpen] = useState(false);
  const { announce } = useToast();

  return (
    <div className="mx-auto max-w-4xl px-8 py-10">
      <h1 className="text-[22px] font-semibold text-[var(--cg-text-primary)]">Component family — Phase 1</h1>
      <p className="mt-1 text-[13px] text-[var(--cg-text-secondary)]">
        Internal QA surface. Not part of the shipped route inventory.
      </p>

      <section className="mt-10">
        <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-[var(--cg-text-muted)]">
          Buttons
        </h2>
        <div className="flex flex-wrap gap-3">
          <Button variant="primary">Primary action</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="destructive">Destructive</Button>
          <Button variant="ai">AI assist</Button>
          <Button variant="primary" disabled>
            Disabled
          </Button>
        </div>
      </section>

      <section className="mt-10">
        <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-[var(--cg-text-muted)]">
          Form controls
        </h2>
        <div className="grid max-w-sm gap-4">
          <TextField label="Focused input" defaultValue="Wireless headphones" />
          <TextField label="Validation error" defaultValue="-4" error="Available stock cannot be negative." />
          <CheckboxField label="Keep me signed in on this device" />
        </div>
      </section>

      <section className="mt-10">
        <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-[var(--cg-text-muted)]">
          Status language
        </h2>
        <div className="flex flex-wrap gap-2">
          {STATUS_TONES.map((s) => (
            <StatusBadge key={s.tone} tone={s.tone}>
              {s.label}
            </StatusBadge>
          ))}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-[var(--cg-text-muted)]">
          Metric cards
        </h2>
        <div className="grid grid-cols-3 gap-4">
          <MetricCard label="Products processed" value="12,480" delta="Last 30 days" />
          <MetricCard label="Need correction" value="418" delta="3.3% of catalog" tone="warning" />
          <MetricCardSkeleton />
        </div>
      </section>

      <section className="mt-10">
        <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-[var(--cg-text-muted)]">
          Alerts
        </h2>
        <div className="flex flex-col gap-3">
          <Alert tone="info" title="Protected access">
            Authentication, active-user checks and RBAC run on every request.
          </Alert>
          <Alert tone="success" title="Feed accepted">
            12,480 rows queued for validation.
          </Alert>
          <Alert tone="warning" title="Duplicate SKU detected">
            18 rows share a seller SKU already in the catalog.
          </Alert>
          <Alert tone="danger" title="Upload rejected">
            File exceeds the 50 MB limit.
          </Alert>
        </div>
      </section>

      <section className="mt-10 grid grid-cols-2 gap-4">
        <div>
          <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-[var(--cg-text-muted)]">
            Empty state
          </h2>
          <EmptyState
            title="The review queue is clear"
            description="All eligible products have a recorded reviewer decision."
            primaryAction={{ label: "Refresh queue" }}
            secondaryAction={{ label: "View reviewed catalog" }}
            meta="Last refreshed 06 Aug 2026 · 11:14:08"
          />
        </div>
        <div>
          <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-[var(--cg-text-muted)]">
            Error state
          </h2>
          <ErrorState
            title="Could not load review queue"
            description="The request could not be completed. Your changes were not submitted."
            correlationId="cg-error-2f41"
            onRetry={() => announce("Retried (demo only)", "info")}
          />
        </div>
      </section>

      <section className="mt-10">
        <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-[var(--cg-text-muted)]">
          Modal &amp; toast
        </h2>
        <div className="flex gap-3">
          <Button variant="secondary" onClick={() => setModalOpen(true)}>
            Open modal
          </Button>
          <Button variant="secondary" onClick={() => announce("Draft saved", "success")}>
            Trigger toast
          </Button>
        </div>
        <Modal
          open={modalOpen}
          titleId="demo-modal-title"
          title="Confirm action"
          onClose={() => setModalOpen(false)}
          footer={
            <>
              <Button variant="secondary" onClick={() => setModalOpen(false)}>
                Cancel
              </Button>
              <Button onClick={() => setModalOpen(false)}>Confirm</Button>
            </>
          }
        >
          Focus is trapped inside this dialog and Escape closes it. Try tabbing through the controls.
        </Modal>
      </section>
    </div>
  );
}
