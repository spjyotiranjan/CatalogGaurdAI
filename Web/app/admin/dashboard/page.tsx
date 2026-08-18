import { AppShell } from "@/components/shell/AppShell";
import { MetricCard } from "@/components/ui/Cards";
import { generateAdminMetrics } from "@/lib/fixtures/metrics";
import { getMockSession } from "@/lib/fixtures/getSession";

/** Screen 15 — Administrator Dashboard (fixture stub). Full modules are UI Phase 5. */
export default function AdminDashboardPage() {
  const user = getMockSession("ADMIN");
  const metrics = generateAdminMetrics();

  return (
    <AppShell user={user} breadcrumb="Marketplace / Administrator" title="Platform dashboard">
      <p className="mb-5 text-[13px] text-[var(--cg-text-secondary)]">
        Track marketplace catalog health, seller activity and processing reliability.
      </p>
      <div className="grid grid-cols-4 gap-4">
        {metrics.map((m) => (
          <MetricCard key={m.label} {...m} />
        ))}
      </div>
      <div className="mt-6 rounded-[12px] border border-dashed border-[var(--cg-border-strong)] bg-white p-6 text-[13px] text-[var(--cg-text-muted)]">
        Feeds, products, sellers, users, categories, validation rules and audit log modules are built
        in UI Phase 5 against real backend contracts.
      </div>
    </AppShell>
  );
}
