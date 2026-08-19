"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/shell/AppShell";
import { Button } from "@/components/ui/Button";
import { MetricCard, MetricCardSkeleton, EmptyState, Skeleton } from "@/components/ui/Cards";
import { FeedStatusBadge } from "@/components/feed/FeedStatusBadge";
import { getMockSession } from "@/lib/fixtures/getSession";
import { listFeeds } from "@/lib/fixtures/feeds";
import { FEED_TYPE_LABEL } from "@/lib/types/feed";
import type { FeedListItem, FeedStatus } from "@/lib/types/feed";
import { cn } from "@/lib/utils/cn";

const FILTERS: { key: "ALL" | FeedStatus; label: string }[] = [
  { key: "ALL", label: "All" },
  { key: "PROCESSING", label: "Processing" },
  { key: "NEEDS_CORRECTION", label: "Correction" },
  { key: "READY", label: "Ready" },
];

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" }) +
    " · " +
    d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

/** Screen 05 — Seller Feed History. Loads once client-side from fixtures (stand-in for a paginated backend read). */
export default function SellerFeedHistoryPage() {
  const user = getMockSession("SELLER_OPERATOR");
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [feeds, setFeeds] = useState<FeedListItem[]>([]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["key"]>("ALL");

  useEffect(() => {
    const t = window.setTimeout(() => {
      setFeeds(listFeeds());
      setLoading(false);
    }, 350);
    return () => window.clearTimeout(t);
  }, []);

  const filtered = useMemo(() => {
    return feeds.filter((f) => {
      const matchesFilter = filter === "ALL" || f.status === filter;
      const matchesQuery =
        query.trim() === "" ||
        f.fileName.toLowerCase().includes(query.toLowerCase()) ||
        f.feedId.toLowerCase().includes(query.toLowerCase());
      return matchesFilter && matchesQuery;
    });
  }, [feeds, filter, query]);

  const metrics = useMemo(() => {
    if (feeds.length === 0) return null;
    const completed = feeds.filter((f) => f.status === "READY").length;
    const needsCorrection = feeds.filter((f) => f.status === "NEEDS_CORRECTION").length;
    const blocked = feeds.filter((f) => f.status === "BLOCKED").length;
    return [
      { label: "Feeds this month", value: feeds.length.toString() },
      { label: "Completed", value: `${Math.round((completed / feeds.length) * 100)}%`, tone: "positive" as const },
      { label: "Needs correction", value: needsCorrection.toString(), tone: "warning" as const },
      { label: "Processing alerts", value: blocked.toString(), tone: "negative" as const },
    ];
  }, [feeds]);

  return (
    <AppShell
      user={user}
      breadcrumb="Marketplace / Seller"
      title="Feed history"
      actions={
        <>
          <Button onClick={() => router.push("/seller/feeds/upload")}>Upload feed</Button>
          <Button variant="secondary">Export history</Button>
        </>
      }
    >
      <p className="mb-5 text-[13px] text-[var(--cg-text-secondary)]">
        Trace every upload, processing result and customer-readiness outcome.
      </p>

      <div className="grid grid-cols-4 gap-4">
        {loading || !metrics
          ? Array.from({ length: 4 }).map((_, i) => <MetricCardSkeleton key={i} />)
          : metrics.map((m) => <MetricCard key={m.label} {...m} />)}
      </div>

      <div className="mt-6 flex items-center gap-3">
        <input
          type="search"
          placeholder="Search file or feed ID"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search feed history"
          className="h-11 flex-1 rounded-[10px] border border-[var(--cg-border-strong)] bg-white px-3.5 text-[13.5px] outline-none focus:border-[var(--cg-purple)]"
        />
        <div className="flex items-center gap-1.5" role="group" aria-label="Filter by status">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              aria-pressed={filter === f.key}
              className={cn(
                "h-9 rounded-full px-3.5 text-[12.5px] font-medium transition-colors",
                filter === f.key
                  ? "bg-[var(--cg-purple)] text-white"
                  : "border border-[var(--cg-border-strong)] text-[var(--cg-text-secondary)] hover:bg-[var(--cg-surface)]"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 overflow-hidden rounded-[12px] border border-[var(--cg-border)] bg-white">
        {loading ? (
          <div className="p-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="mb-3 h-10 w-full" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-8">
            <EmptyState
              title={feeds.length === 0 ? "No feeds uploaded yet" : "No feeds match your filters"}
              description={
                feeds.length === 0
                  ? "Upload your first CSV catalog feed to see processing results here."
                  : "Try a different search term or clear the status filter."
              }
              primaryAction={{ label: "Upload feed", onClick: () => router.push("/seller/feeds/upload") }}
              secondaryAction={
                feeds.length !== 0
                  ? { label: "Clear filters", onClick: () => { setFilter("ALL"); setQuery(""); } }
                  : undefined
              }
            />
          </div>
        ) : (
          <table className="w-full text-left text-[13px]">
            <thead>
              <tr className="border-b border-[var(--cg-border)] text-[11.5px] uppercase tracking-wide text-[var(--cg-text-muted)]">
                <th className="px-5 py-3 font-medium">File</th>
                <th className="px-5 py-3 font-medium">Feed type</th>
                <th className="px-5 py-3 font-medium">Records</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Uploaded</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((f) => (
                <tr
                  key={f.feedId}
                  tabIndex={0}
                  role="button"
                  onClick={() => router.push(`/seller/feeds/${f.feedId}`)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") router.push(`/seller/feeds/${f.feedId}`);
                  }}
                  className="cursor-pointer border-b border-[var(--cg-border)] last:border-0 hover:bg-[var(--cg-surface)]"
                >
                  <td className="cg-mono px-5 py-3.5 text-[var(--cg-text-primary)]">{f.fileName}</td>
                  <td className="px-5 py-3.5 text-[var(--cg-text-secondary)]">{FEED_TYPE_LABEL[f.feedType]}</td>
                  <td className="px-5 py-3.5 text-[var(--cg-text-secondary)]">{f.recordCount.toLocaleString()}</td>
                  <td className="px-5 py-3.5">
                    <FeedStatusBadge status={f.status} />
                  </td>
                  <td className="px-5 py-3.5 text-[var(--cg-text-muted)]">{formatDate(f.uploadedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </AppShell>
  );
}
