import {
  ACCEPTED_FEED_EXTENSIONS,
  MAX_FEED_UPLOAD_BYTES,
  STAGE_ORDER,
} from "@/lib/types/feed";
import type {
  FeedDetail,
  FeedListItem,
  FeedStatus,
  FeedType,
  StageKey,
  SubmitFeedResult,
  UploadPreflightResult,
} from "@/lib/types/feed";
import { makeCorrelationId } from "@/lib/fixtures/session";

/**
 * Fixture-only feed store. Runs entirely client-side (no Node/db access) so
 * it can back the interactive upload/history/detail screens before Web
 * Backend Phase 2 exists. State resets on full page reload — that's
 * expected for a fixture, not a real persistence layer.
 *
 * Stage timing is keyed off real elapsed time since "upload" so polling the
 * same feed genuinely reflects progress rather than an animated bar tied
 * to a client timer (per UI_DEVELOPMENT_PLAN.md Phase 2: "Do not simulate
 * progress with timers").
 */

interface InternalFeedRecord {
  feedId: string;
  fileName: string;
  feedType: FeedType;
  recordCount: number;
  uploadedAtMs: number;
  correlationId: string;
  checksum: string;
  mappingVersion: string;
  sourceRows: number;
  /** Historical/seed records skip live stage computation and use a fixed outcome. */
  fixedOutcome?: { status: FeedStatus; stage: StageKey };
}

const STAGE_ELAPSED_MS: Record<StageKey, number> = {
  UPLOADED: 0,
  PARSED: 2_500,
  NORMALIZED: 5_000,
  RULES: 9_000,
  AI: 13_000,
  REVIEW: 17_000,
  READY: 21_000,
};

function toyChecksum(fileName: string, sizeBytes: number): string {
  let hash = 0;
  const input = `${fileName}:${sizeBytes}`;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  return `sha256-${hash.toString(16).padStart(8, "0")}…`;
}

const store = new Map<string, InternalFeedRecord>();
let seeded = false;

function seed() {
  if (seeded) return;
  seeded = true;
  const now = Date.now();
  const day = 86_400_000;
  const rows: Array<[string, FeedType, number, number, FeedStatus, StageKey]> = [
    ["northstar_catalog_2026-08-06.csv", "FULL_CATALOG", 12_480, 0, "NEEDS_CORRECTION", "REVIEW"],
    ["northstar_inventory_2026-08-05.csv", "INVENTORY", 12_442, 1, "READY", "READY"],
    ["urbanloom_full_2026-08-05.csv", "FULL_CATALOG", 8_116, 1, "IN_REVIEW", "REVIEW"],
    ["acmehome_catalog_2026-08-04.csv", "FULL_CATALOG", 19_850, 2, "BLOCKED", "RULES"],
    ["threadworks_daily_2026-08-04.csv", "DAILY", 6_730, 2, "READY", "READY"],
    ["northstar_price_2026-08-03.csv", "PRICING", 12_480, 3, "READY", "READY"],
    ["northstar_catalog_2026-08-02.csv", "FULL_CATALOG", 12_401, 4, "SUPERSEDED", "READY"],
  ];

  rows.forEach(([fileName, feedType, recordCount, daysAgo, status, stage], idx) => {
    const feedId = `FEED-2026080${6 - daysAgo}-${900 + idx}`;
    store.set(feedId, {
      feedId,
      fileName,
      feedType,
      recordCount,
      uploadedAtMs: now - daysAgo * day - idx * 3_600_000,
      correlationId: makeCorrelationId(),
      checksum: toyChecksum(fileName, recordCount * 97),
      mappingVersion: "catalog-map/v3.4",
      sourceRows: recordCount,
      fixedOutcome: { status, stage },
    });
  });
}

export function preflightFile(file: { name: string; size: number }): UploadPreflightResult {
  const lowerName = file.name.toLowerCase();
  const hasAcceptedExtension = ACCEPTED_FEED_EXTENSIONS.some((ext) => lowerName.endsWith(ext));
  if (!hasAcceptedExtension) {
    return {
      ok: false,
      reason: "EXTENSION",
      message: "Only CSV files are accepted for this MVP. Rename or export your feed as .csv.",
    };
  }
  if (file.size > MAX_FEED_UPLOAD_BYTES) {
    return {
      ok: false,
      reason: "SIZE",
      message: `File is ${(file.size / (1024 * 1024)).toFixed(1)} MB. Maximum upload size is 50 MB.`,
    };
  }
  return { ok: true };
}

export function submitFeedUpload(input: {
  fileName: string;
  sizeBytes: number;
  feedType: FeedType;
}): Promise<SubmitFeedResult> {
  seed();
  const correlationId = makeCorrelationId();

  return new Promise((resolve) => {
    // Simulated network + server-commit latency — not a progress animation,
    // just standing in for the real request round trip.
    window.setTimeout(() => {
      const lowerName = input.fileName.toLowerCase();

      if (lowerName.includes("fail")) {
        resolve({
          ok: false,
          reason: "SERVER_ERROR",
          message: "The upload could not be committed. No feed record was created.",
          correlationId,
        });
        return;
      }

      const checksum = toyChecksum(input.fileName, input.sizeBytes);
      const duplicate = [...store.values()].find((f) => f.checksum === checksum);
      if (duplicate) {
        resolve({
          ok: false,
          reason: "DUPLICATE",
          message: "This exact file was already uploaded for this seller.",
          existingFeedId: duplicate.feedId,
          correlationId,
        });
        return;
      }

      const feedId = `FEED-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Math.floor(
        Math.random() * 900 + 100
      )}`;
      const recordCount = Math.floor(Math.random() * 9000) + 3000;
      store.set(feedId, {
        feedId,
        fileName: input.fileName,
        feedType: input.feedType,
        recordCount,
        uploadedAtMs: Date.now(),
        correlationId,
        checksum,
        mappingVersion: "catalog-map/v3.4",
        sourceRows: recordCount,
      });

      resolve({ ok: true, feedId, correlationId });
    }, 550);
  });
}

function toListItem(rec: InternalFeedRecord): FeedListItem {
  const { status } = resolveStage(rec);
  return {
    feedId: rec.feedId,
    fileName: rec.fileName,
    feedType: rec.feedType,
    recordCount: rec.recordCount,
    status,
    uploadedAt: new Date(rec.uploadedAtMs).toISOString(),
    correlationId: rec.correlationId,
  };
}

function resolveStage(rec: InternalFeedRecord): { stage: StageKey; status: FeedStatus } {
  if (rec.fixedOutcome) return { stage: rec.fixedOutcome.stage, status: rec.fixedOutcome.status };

  const elapsed = Date.now() - rec.uploadedAtMs;
  let stage: StageKey = "UPLOADED";
  for (const s of STAGE_ORDER) {
    if (elapsed >= STAGE_ELAPSED_MS[s.key]) stage = s.key;
  }

  // Deterministic-but-varied outcome per feed once processing completes.
  const seedNum = rec.fileName.length + rec.recordCount;
  const hasBlocker = seedNum % 5 === 0;
  const hasCorrection = seedNum % 3 === 0;

  let status: FeedStatus = "PROCESSING";
  if (stage === "RULES" && hasBlocker) status = "BLOCKED";
  else if (stage === "REVIEW") status = hasCorrection ? "NEEDS_CORRECTION" : "IN_REVIEW";
  else if (stage === "READY") status = hasBlocker ? "BLOCKED" : hasCorrection ? "NEEDS_CORRECTION" : "READY";

  if (status === "BLOCKED" && stage !== "READY") {
    // Blocked feeds stop advancing past RULES.
    stage = "RULES";
  }

  return { stage, status };
}

export function listFeeds(): FeedListItem[] {
  seed();
  return [...store.values()]
    .sort((a, b) => b.uploadedAtMs - a.uploadedAtMs)
    .map(toListItem);
}

export function getFeedDetail(feedId: string): FeedDetail | null {
  seed();
  const rec = store.get(feedId);
  if (!rec) return null;

  const { stage, status } = resolveStage(rec);
  const seedNum = rec.fileName.length + rec.recordCount;
  const blockingCount = status === "BLOCKED" ? (seedNum % 40) + 8 : 0;
  const rowsWithIssues = status === "READY" ? 0 : (seedNum % 400) + blockingCount + 20;
  const awaitingReviewCount = status === "IN_REVIEW" || status === "NEEDS_CORRECTION" ? (seedNum % 150) + 30 : 0;

  const validationBreakdown = [
    { label: "Required fields", count: (seedNum % 130) + 10, tone: "system" as const },
    { label: "Pricing", count: (seedNum % 90) + (status === "BLOCKED" ? 20 : 2), tone: "blocked" as const },
    { label: "Inventory", count: (seedNum % 80) + 5, tone: "warning" as const },
    { label: "Category", count: (seedNum % 70) + 3, tone: "system" as const },
    { label: "Duplicate SKU", count: (seedNum % 40) + 1, tone: "neutral" as const },
  ];

  const nextAction =
    status === "BLOCKED"
      ? {
          title: "Blocking issues prevent review submission.",
          description: `Correct ${blockingCount} blocking records, rerun validation, then submit the clean version for reviewer approval.`,
          ctaLabel: "Open corrections",
          tone: "blocked" as const,
        }
      : status === "NEEDS_CORRECTION"
        ? {
            title: "Some records need a seller correction before review.",
            description: "Deterministic checks passed but a few fields need your input before a reviewer sees this feed.",
            ctaLabel: "Open corrections",
            tone: "system" as const,
          }
        : status === "IN_REVIEW"
          ? {
              title: "Awaiting reviewer decision.",
              description: "Deterministic and AI checks are complete. A catalog reviewer will approve or request changes.",
              ctaLabel: "View catalog",
              tone: "system" as const,
            }
          : status === "READY"
            ? {
                title: "This feed is customer-ready.",
                description: "All records passed validation and reviewer approval.",
                ctaLabel: "View catalog",
                tone: "ready" as const,
              }
            : {
                title: "Processing is underway.",
                description: "Deterministic validation runs before AI analysis. This page updates automatically.",
                ctaLabel: "Refresh status",
                tone: "system" as const,
              };

  return {
    feedId: rec.feedId,
    fileName: rec.fileName,
    feedType: rec.feedType,
    recordCount: rec.recordCount,
    status,
    uploadedAt: new Date(rec.uploadedAtMs).toISOString(),
    correlationId: rec.correlationId,
    sourceRows: rec.sourceRows,
    mappedRows: rec.sourceRows - (seedNum % 6),
    rowsWithIssues,
    blockingCount,
    awaitingReviewCount,
    checksum: rec.checksum,
    mappingVersion: rec.mappingVersion,
    currentStage: stage,
    validationBreakdown,
    nextAction,
  };
}

export function isFeedStillProcessing(detail: FeedDetail): boolean {
  return detail.status === "PROCESSING";
}
