import { AppShell } from "@/components/shell/AppShell";
import { MetricCard } from "@/components/ui/Cards";
import { generateReviewerMetrics } from "@/lib/fixtures/metrics";
import { requirePageSession } from "@/server/auth/page-session";

/** Screen 09 — Reviewer Dashboard (fixture stub). Full queue is UI Phase 4. */
export default async function ReviewerDashboardPage() {
  const user = await requirePageSession(["CATALOG_REVIEWER", "ADMIN"]);
  const metrics = generateReviewerMetrics();
  return (
    <AppShell user={user} breadcrumb="Marketplace / Reviewer" title="Reviewer dashboard">
      <p className="mb-5 text-[13px] text-[var(--cg-text-secondary)]">
        Prioritize high-risk products and keep the decision backlog moving.
      </p>
      <div className="grid grid-cols-4 gap-4">{metrics.map((metric) => <MetricCard key={metric.label} {...metric} />)}</div>
    </AppShell>
  );
}
