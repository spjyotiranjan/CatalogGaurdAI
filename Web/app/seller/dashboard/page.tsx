import { AppShell } from "@/components/shell/AppShell";
import { MetricCard } from "@/components/ui/Cards";
import { generateSellerMetrics } from "@/lib/fixtures/metrics";
import { getMockSession } from "@/lib/fixtures/getSession";

/**
 * Screen 03 — Seller Dashboard (fixture stub).
 *
 * Phase 1 only requires the shell to render correctly per role; the full
 * "items requiring attention" / "issues by family" / "feed processing"
 * regions belong to UI Phase 2. This stub proves AppShell + RoleNav +
 * MetricCard render together, populated with randomized mock data.
 */
export default function SellerDashboardPage() {
  const user = getMockSession("SELLER_OPERATOR");
  const metrics = generateSellerMetrics();

  return (
    <AppShell user={user} breadcrumb="Marketplace / Seller" title="Seller dashboard">
      <p className="mb-5 text-[13px] text-[var(--cg-text-secondary)]">
        Monitor feed quality, corrections and customer-readiness for your catalog.
      </p>
      <div className="grid grid-cols-4 gap-4">
        {metrics.map((m) => (
          <MetricCard key={m.label} {...m} />
        ))}
      </div>
      <div className="mt-6 rounded-[12px] border border-dashed border-[var(--cg-border-strong)] bg-white p-6 text-[13px] text-[var(--cg-text-muted)]">
        Upload feed, feed history, product catalog and correction workspace are built in UI Phase 2 and
        3 against real backend contracts.
      </div>
    </AppShell>
  );
}
