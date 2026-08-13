/**
 * Deterministic-looking but randomized fixture data for the Phase 1 shell
 * demo pages. This is NOT a real read model — Web Backend Phase 5 owns
 * dashboard read models. It exists so the app shell + metric card
 * component can be seen populated instead of empty during Phase 1 review.
 */

export interface MetricCardData {
  label: string;
  value: string;
  delta?: string;
  tone?: "neutral" | "positive" | "warning" | "negative";
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pct(n: number): string {
  return `${n.toFixed(1)}%`;
}

export function generateSellerMetrics(): MetricCardData[] {
  const processed = randInt(8000, 14000);
  const correction = randInt(150, 600);
  const firstPass = 100 - (correction / processed) * 100;
  const ready = processed - correction - randInt(0, 40);
  return [
    { label: "Products processed", value: processed.toLocaleString(), delta: "Last 30 days" },
    {
      label: "Need correction",
      value: correction.toLocaleString(),
      delta: `${pct((correction / processed) * 100)} of catalog`,
      tone: "warning",
    },
    { label: "First-pass valid", value: pct(firstPass), delta: `+${(Math.random() * 3).toFixed(1)}% vs prior`, tone: "positive" },
    { label: "Customer-ready", value: ready.toLocaleString(), delta: `${pct((ready / processed) * 100)} approved`, tone: "positive" },
  ];
}

export function generateReviewerMetrics(): MetricCardData[] {
  const awaiting = randInt(60, 180);
  const blocking = randInt(10, 50);
  const sla = randInt(78, 96);
  const decisions = randInt(200, 500);
  return [
    { label: "Awaiting review", value: awaiting.toString(), delta: `Oldest ${randInt(1, 4)}h ${randInt(1, 59)}m` },
    { label: "Blocking issues", value: blocking.toString(), delta: `Across ${randInt(8, 40)} sellers`, tone: "negative" },
    { label: "Within SLA", value: pct(sla), delta: "Target >= 90%", tone: sla >= 90 ? "positive" : "warning" },
    { label: "Decisions today", value: decisions.toString(), delta: `${randInt(80, 96)}% approved`, tone: "positive" },
  ];
}

export function generateAdminMetrics(): MetricCardData[] {
  const sellers = randInt(1400, 2200);
  const products = randInt(3_000_000, 4_800_000);
  const quality = randInt(88, 97);
  const blockers = randInt(120, 320);
  return [
    { label: "Active sellers", value: sellers.toLocaleString(), delta: `+${randInt(4, 40)} this month` },
    { label: "Products checked", value: `${(products / 1_000_000).toFixed(1)}M`, delta: "Last 30 days" },
    { label: "Catalog quality", value: pct(quality), delta: `+${(Math.random() * 2).toFixed(1)}% vs prior`, tone: "positive" },
    { label: "Open blockers", value: blockers.toString(), delta: `Across ${randInt(30, 80)} feeds`, tone: "negative" },
  ];
}
