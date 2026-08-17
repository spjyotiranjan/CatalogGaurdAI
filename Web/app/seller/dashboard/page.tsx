"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/shell/AppShell";
import { Button } from "@/components/ui/Button";
import { MetricCard, Skeleton } from "@/components/ui/Cards";
import { Alert } from "@/components/ui/Cards";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ProcessingTimeline } from "@/components/feed/ProcessingTimeline";
import { getMockSession } from "@/lib/fixtures/getSession";
import { listFeeds } from "@/lib/fixtures/feeds";
import { FEED_TYPE_LABEL } from "@/lib/types/feed";
import type { FeedListItem, StageKey } from "@/lib/types/feed";
import { generateSellerMetrics } from "@/lib/fixtures/metrics";

/** Screen 03 — Seller Dashboard. Full fidelity per UI Phase 2 scope. */
export default function SellerDashboardPage() {
  const user = getMockSession("SELLER_OPERATOR");
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [feeds, setFeeds] = useState<FeedListItem[]>([]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      setFeeds(listFeeds());
      setLoading(false);
    }, 350);
    return () => window.clearTimeout(t);
  }, []);

  const metrics = useMemo(() => generateSellerMetrics(), []);
  const attention = useMemo(
    () => feeds.filter((f) => f.status === "BLOCKED" || f.status === "NEEDS_CORRECTION").slice(0, 4),
    [feeds]
  );
  const latestFeed = feeds[0] ?? null;

  const latestStage: StageKey = !latestFeed
    ? "UPLOADED"
    : latestFeed.status === "READY"
      ? "READY"
      : latestFeed.status === "BLOCKED"
        ? "RULES"
        : latestFeed.status === "PROCESSING"
          ? "NORMALIZED"
          : "REVIEW";

  return (
    <AppShell
      user={user}
      breadcrumb="Marketplace / Seller"
      title="Seller dashboard"
      actions={
        <>
          <Button onClick={() => router.push("/seller/feeds/upload")}>Upload feed</Button>
          <Button variant="secondary" onClick={() => router.push("/seller/feeds")}>
            Export report
          </Button>
        </>
      }
    >
      <p className="mb-5 text-[13px] text-[var(--cg-text-secondary)]">
        Monitor feed quality, corrections and customer-readiness for your catalog.
      </p>

      <div className="grid grid-cols-4 gap-4">
        {metrics.map((m) => (
          <MetricCard key={m.label} {...m} />
        ))}
      </div>

      <div className="mt-5 grid grid-cols-[1fr_320px] gap-5">
        <div className="rounded-[12px] border border-[var(--cg-border)] bg-white p-6">
          <p className="mb-1 text-[13px] font-semibold text-[var(--cg-text-primary)]">Items requiring attention</p>
          <p className="mb-4 text-[12px] text-[var(--cg-text-muted)]">Ordered by customer impact, severity and age.</p>

          {loading ? (
            <div className="flex flex-col gap-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : attention.length === 0 ? (
            <p className="py-6 text-center text-[12.5px] text-[var(--cg-text-muted)]">
              Nothing needs your attention right now.
            </p>
          ) : (
            <ul className="flex flex-col divide-y divide-[var(--cg-border)]">
              {attention.map((f) => (
                <li
                  key={f.feedId}
                  className="flex cursor-pointer items-center justify-between py-3 first:pt-0 last:pb-0 hover:bg-[var(--cg-surface)]"
                  onClick={() => router.push(`/seller/feeds/${f.feedId}`)}
                >
                  <div>
                    <p className="text-[13px] font-medium text-[var(--cg-text-primary)]">{f.fileName}</p>
                    <p className="text-[11.5px] text-[var(--cg-text-muted)]">{FEED_TYPE_LABEL[f.feedType]}</p>
                  </div>
                  <StatusBadge tone={f.status === "BLOCKED" ? "blocked" : "warning"}>
                    {f.status === "BLOCKED" ? "Blocked" : "Correction"}
                  </StatusBadge>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-[12px] border border-[var(--cg-border)] bg-white p-6">
          <p className="mb-1 text-[13px] font-semibold text-[var(--cg-text-primary)]">Recent uploads</p>
          <p className="mb-4 text-[12px] text-[var(--cg-text-muted)]">Last 7 days</p>
          {loading ? (
            <Skeleton className="h-32 w-full" />
          ) : (
            <ul className="flex flex-col gap-2.5">
              {feeds.slice(0, 5).map((f) => (
                <li key={f.feedId} className="flex items-center justify-between text-[12px]">
                  <span className="cg-mono truncate text-[var(--cg-text-secondary)]">{f.feedId}</span>
                  <StatusBadge tone={f.status === "READY" ? "ready" : f.status === "BLOCKED" ? "blocked" : "system"}>
                    {f.status === "READY" ? "Ready" : f.status === "BLOCKED" ? "Blocked" : "Processing"}
                  </StatusBadge>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="mt-5 rounded-[12px] border border-[var(--cg-border)] bg-white p-6">
        <p className="mb-1 text-[13px] font-semibold text-[var(--cg-text-primary)]">Feed processing</p>
        {loading || !latestFeed ? (
          <Skeleton className="mt-3 h-10 w-full" />
        ) : (
          <ProcessingTimeline currentStage={latestStage} blocked={latestFeed.status === "BLOCKED"} />
        )}
      </div>

      <div className="mt-5">
        <Alert tone="info" title="Operational note">
          Resolve blocking errors before submitting records for review.
          {latestFeed ? (
            <span className="mt-1 block cg-mono text-[11.5px]">
              Latest feed: {latestFeed.fileName} · {latestFeed.recordCount.toLocaleString()} records
            </span>
          ) : null}
        </Alert>
      </div>
    </AppShell>
  );
}
