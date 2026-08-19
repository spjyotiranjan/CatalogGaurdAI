import { AppShell } from "@/components/shell/AppShell";
import { MetricCard } from "@/components/ui/Cards";
import { generateAdminMetrics } from "@/lib/fixtures/metrics";
import { requirePageSession } from "@/server/auth/page-session";

/** Screen 15 — Administrator Dashboard (fixture stub). Full modules are UI Phase 5. */
export default async function AdminDashboardPage() {
  const user = await requirePageSession(["ADMIN"]);
  const metrics = generateAdminMetrics();
  return (
    <AppShell user={user} breadcrumb="Marketplace / Administrator" title="Platform dashboard">
      <p className="mb-5 text-[13px] text-[var(--cg-text-secondary)]">
        Track marketplace catalog health, seller activity and processing reliability.
      </p>
      <div className="grid grid-cols-4 gap-4">{metrics.map((metric) => <MetricCard key={metric.label} {...metric} />)}</div>
    </AppShell>
  );
}
