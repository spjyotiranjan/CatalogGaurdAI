"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AppShell } from "@/components/shell/AppShell";
import { Button } from "@/components/ui/Button";
import { MetricCard, MetricCardSkeleton, ErrorState, Skeleton } from "@/components/ui/Cards";
import { Alert } from "@/components/ui/Cards";
import { ProcessingTimeline } from "@/components/feed/ProcessingTimeline";
import { FeedStatusBadge } from "@/components/feed/FeedStatusBadge";
import { getMockSession } from "@/lib/fixtures/getSession";
import { getFeedDetail, isFeedStillProcessing } from "@/lib/fixtures/feeds";
import { makeCorrelationId } from "@/lib/fixtures/session";
import type { FeedDetail } from "@/lib/types/feed";

type LoadState =
  | { kind: "loading" }
  | { kind: "loaded"; detail: FeedDetail }
  | { kind: "error"; correlationId: string };

const POLL_INTERVAL_MS = 4_000;

/**
 * Screen 06 — Feed Detail.
 *
 * Polls the (fixture) backend for the current stage/status rather than
 * animating one locally. Polling stops once the feed reaches a terminal
 * status (READY/BLOCKED/NEEDS_CORRECTION/IN_REVIEW/SUPERSEDED) — only
 * PROCESSING keeps polling, matching "reconnect with bounded backoff" in
 * spirit without inventing fake progress.
 */
export default function FeedDetailPage() {
  const params = useParams<{ feedId: string }>();
  const feedId = params.feedId;
  const user = getMockSession("SELLER_OPERATOR");
  const router = useRouter();

  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const announceRef = useRef<HTMLDivElement>(null);
  const lastStageRef = useRef<string | null>(null);

  const fetchDetail = useCallback(() => {
    // Simulated fetch failure only for a special demo id, so this stays
    // deterministic rather than flaky for everyone else.
    if (feedId === "err-demo") {
      setState({ kind: "error", correlationId: makeCorrelationId() });
      return;
    }
    const detail = getFeedDetail(feedId);
    if (!detail) {
      setState({ kind: "error", correlationId: makeCorrelationId() });
      return;
    }
    setState({ kind: "loaded", detail });
    if (lastStageRef.current && lastStageRef.current !== detail.currentStage && announceRef.current) {
      announceRef.current.textContent = `Feed processing stage updated to ${detail.currentStage.toLowerCase()}.`;
    }
    lastStageRef.current = detail.currentStage;
  }, [feedId]);

  useEffect(() => {
    const t = window.setTimeout(fetchDetail, 300); // simulated initial load latency
    return () => window.clearTimeout(t);
  }, [fetchDetail]);

  useEffect(() => {
    if (state.kind !== "loaded" || !isFeedStillProcessing(state.detail)) return;
    const interval = window.setInterval(fetchDetail, POLL_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [state, fetchDetail]);

  return (
    <AppShell
      user={user}
      breadcrumb="Marketplace / Seller"
      title="Feed detail"
      actions={
        state.kind === "loaded" ? (
          <>
            <Button variant="secondary" onClick={() => alert("Authorized short-lived download link (demo only)")}>
              Download source
            </Button>
            <Button onClick={() => router.push("/seller/feeds")}>Back to history</Button>
          </>
        ) : undefined
      }
    >
      <div ref={announceRef} aria-live="polite" role="status" className="cg-sr-only" />

      {state.kind === "loading" ? (
        <div className="flex flex-col gap-5">
          <Skeleton className="h-24 w-full rounded-[12px]" />
          <div className="grid grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <MetricCardSkeleton key={i} />
            ))}
          </div>
        </div>
      ) : state.kind === "error" ? (
        <ErrorState
          title="Could not load feed detail"
          description="The request could not be completed. No feed data was changed."
          correlationId={state.correlationId}
          onRetry={() => {
            setState({ kind: "loading" });
            window.setTimeout(fetchDetail, 300);
          }}
        />
      ) : (
        <FeedDetailContent detail={state.detail} />
      )}
    </AppShell>
  );
}

function FeedDetailContent({ detail }: { detail: FeedDetail }) {
  const stillProcessing = isFeedStillProcessing(detail);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="cg-mono text-[12px] text-[var(--cg-text-muted)]">{detail.feedId}</p>
          <p className="mt-0.5 text-[13px] text-[var(--cg-text-secondary)]">
            Inspect processing evidence, validation outcomes and the next permitted action.
          </p>
        </div>
        <FeedStatusBadge status={detail.status} />
      </div>

      <div className="rounded-[12px] border border-[var(--cg-border)] bg-white p-5">
        <ProcessingTimeline currentStage={detail.currentStage} blocked={detail.status === "BLOCKED"} />
        {stillProcessing ? (
          <p className="mt-3 text-[11.5px] text-[var(--cg-text-muted)]">
            This page updates automatically every few seconds while processing continues.
          </p>
        ) : null}
      </div>

      <div className="grid grid-cols-4 gap-4">
        <MetricCard label="Source rows" value={detail.sourceRows.toLocaleString()} delta={`${detail.mappedRows.toLocaleString()} mapped`} />
        <MetricCard
          label="Rows with issues"
          value={detail.rowsWithIssues.toLocaleString()}
          delta={`${((detail.rowsWithIssues / detail.sourceRows) * 100).toFixed(1)}% of feed`}
          tone={detail.rowsWithIssues > 0 ? "warning" : "positive"}
        />
        <MetricCard
          label="Blocking"
          value={detail.blockingCount.toLocaleString()}
          delta={detail.blockingCount > 0 ? "Must be corrected" : "None"}
          tone={detail.blockingCount > 0 ? "negative" : "positive"}
        />
        <MetricCard
          label="Awaiting review"
          value={detail.awaitingReviewCount.toLocaleString()}
          delta={detail.awaitingReviewCount > 0 ? "AI checks complete" : "Not yet eligible"}
        />
      </div>

      <div className="grid grid-cols-[1fr_320px] gap-5">
        <div className="rounded-[12px] border border-[var(--cg-border)] bg-white p-6">
          <p className="mb-1 text-[13px] font-semibold text-[var(--cg-text-primary)]">Validation summary</p>
          <p className="cg-mono mb-4 text-[11.5px] text-[var(--cg-text-muted)]">
            {detail.fileName} · {detail.feedId}
          </p>
          <ul className="flex flex-col gap-3">
            {detail.validationBreakdown.map((row) => {
              const max = Math.max(...detail.validationBreakdown.map((r) => r.count), 1);
              const pct = Math.round((row.count / max) * 100);
              const barColor =
                row.tone === "blocked"
                  ? "var(--cg-red)"
                  : row.tone === "warning"
                    ? "var(--cg-amber)"
                    : row.tone === "system"
                      ? "var(--cg-blue)"
                      : "var(--cg-purple)";
              return (
                <li key={row.label} className="flex items-center gap-3">
                  <span className="w-32 flex-shrink-0 text-[12.5px] text-[var(--cg-text-secondary)]">
                    {row.label}
                  </span>
                  <span className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--cg-surface)]">
                    <span
                      className="block h-full rounded-full"
                      style={{ width: `${pct}%`, backgroundColor: barColor }}
                    />
                  </span>
                  <span className="w-10 text-right text-[12.5px] font-medium text-[var(--cg-text-primary)]">
                    {row.count}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="flex flex-col gap-5">
          <div className="rounded-[12px] border border-[var(--cg-border)] bg-white p-6">
            <p className="mb-3 text-[13px] font-semibold text-[var(--cg-text-primary)]">Source integrity</p>
            <p className="mb-1 text-[11.5px] text-[var(--cg-text-muted)]">Checksum</p>
            <p className="cg-mono mb-3 text-[12px] text-[var(--cg-text-primary)]">{detail.checksum}</p>
            <p className="mb-1 text-[11.5px] text-[var(--cg-text-muted)]">Mapping version</p>
            <p className="cg-mono text-[12px] text-[var(--cg-text-primary)]">{detail.mappingVersion}</p>
            <p className="mt-3 border-t border-[var(--cg-border)] pt-3 text-[11px] text-[var(--cg-text-muted)]">
              Processing correlation ID
            </p>
            <p className="cg-mono text-[11.5px] text-[var(--cg-text-muted)]">{detail.correlationId}</p>
          </div>

          <Alert tone={detail.nextAction.tone === "blocked" ? "danger" : detail.nextAction.tone === "ready" ? "success" : "info"} title={detail.nextAction.title}>
            {detail.nextAction.description}
          </Alert>

          <div className="rounded-[12px] border border-dashed border-[var(--cg-border-strong)] bg-white p-4 text-center text-[12px] text-[var(--cg-text-muted)]">
            {detail.nextAction.ctaLabel} is available once Product Catalog and Correction ship in UI Phase 3.
          </div>
        </div>
      </div>
    </div>
  );
}
