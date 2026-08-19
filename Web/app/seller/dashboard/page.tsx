import { AppShell } from "@/components/shell/AppShell";
import { MetricCard } from "@/components/ui/Cards";
import { generateSellerMetrics } from "@/lib/fixtures/metrics";
import { requirePageSession } from "@/server/auth/page-session";

/**
 * Screen 03 — Seller Dashboard (fixture stub).
 *
 * Phase 1 only requires the shell to render correctly per role; the full
 * "items requiring attention" / "issues by family" / "feed processing"
 * regions belong to UI Phase 2. This stub proves AppShell + RoleNav +
 * MetricCard render together, populated with randomized mock data.
 */
export default async function SellerDashboardPage() {
  const user = await requirePageSession(["SELLER_OPERATOR"]);
  const metrics = generateSellerMetrics();
  return (
    <AppShell user={user} breadcrumb="Marketplace / Seller" title="Seller dashboard">
      <p className="mb-5 text-[13px] text-[var(--cg-text-secondary)]">
        Monitor feed quality, corrections and customer-readiness for your catalog.
      </p>
      <div className="grid grid-cols-4 gap-4">{metrics.map((metric) => <MetricCard key={metric.label} {...metric} />)}</div>
    </AppShell>
  );
}
