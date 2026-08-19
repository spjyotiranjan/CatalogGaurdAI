/**
 * Screen-state contract types for UI Phase 2 (Seller feed-intake).
 *
 * Same rule as lib/types/session.ts: these are fixture-shaped stand-ins for
 * the real Web Backend Phase 2 contract (persisted FEED_UPLOAD, dispatch,
 * signed ValidationJobResult callback). Nothing here performs an upload,
 * a mutation, or an authorization decision — see AGENTS.md system-wide
 * invariants and ARCHITECTURE_DECISIONS.md D-006/D-002.
 */

/** D-002: CSV is the only enabled upload format for the MVP. */
export const ACCEPTED_FEED_EXTENSIONS = [".csv"] as const;
export const MAX_FEED_UPLOAD_BYTES = 50 * 1024 * 1024; // 50 MB, per Implementation Design 3.4.4

export type FeedType = "FULL_CATALOG" | "INVENTORY" | "PRICING" | "DAILY" | "DELTA";

export const FEED_TYPE_LABEL: Record<FeedType, string> = {
  FULL_CATALOG: "Full catalog",
  INVENTORY: "Inventory",
  PRICING: "Pricing",
  DAILY: "Daily",
  DELTA: "Delta",
};

/**
 * Compatibility read-model status shown in tables (mirrors the derived
 * `catalogStatus` concept from D-004 — never client-writable).
 */
export type FeedStatus =
  | "PROCESSING"
  | "NEEDS_CORRECTION"
  | "IN_REVIEW"
  | "READY"
  | "BLOCKED"
  | "SUPERSEDED";

export const FEED_STATUS_LABEL: Record<FeedStatus, string> = {
  PROCESSING: "Processing",
  NEEDS_CORRECTION: "Needs correction",
  IN_REVIEW: "In review",
  READY: "Ready",
  BLOCKED: "Blocked",
  SUPERSEDED: "Superseded",
};

export const FEED_STATUS_TONE: Record<FeedStatus, "ready" | "warning" | "in-review" | "system" | "blocked" | "neutral"> = {
  PROCESSING: "system",
  NEEDS_CORRECTION: "warning",
  IN_REVIEW: "in-review",
  READY: "ready",
  BLOCKED: "blocked",
  SUPERSEDED: "neutral",
};

/** Ordered processing stages shown on the timeline (Backend Flow diagram). */
export type StageKey = "UPLOADED" | "PARSED" | "NORMALIZED" | "RULES" | "AI" | "REVIEW" | "READY";

export const STAGE_ORDER: { key: StageKey; label: string }[] = [
  { key: "UPLOADED", label: "Uploaded" },
  { key: "PARSED", label: "Parsed" },
  { key: "NORMALIZED", label: "Normalized" },
  { key: "RULES", label: "Rules" },
  { key: "AI", label: "AI" },
  { key: "REVIEW", label: "Review" },
  { key: "READY", label: "Ready" },
];

export interface FeedListItem {
  feedId: string;
  fileName: string;
  feedType: FeedType;
  recordCount: number;
  status: FeedStatus;
  uploadedAt: string; // ISO
  correlationId: string;
}

export interface ValidationBreakdownRow {
  label: string;
  count: number;
  tone: "warning" | "blocked" | "system" | "neutral";
}

export interface FeedDetail extends FeedListItem {
  sourceRows: number;
  mappedRows: number;
  rowsWithIssues: number;
  blockingCount: number;
  awaitingReviewCount: number;
  checksum: string;
  mappingVersion: string;
  currentStage: StageKey;
  validationBreakdown: ValidationBreakdownRow[];
  nextAction: {
    title: string;
    description: string;
    ctaLabel: string;
    tone: "blocked" | "system" | "ready";
  };
}

export type UploadRejectionReason = "EXTENSION" | "SIZE";

export interface UploadPreflightResult {
  ok: boolean;
  reason?: UploadRejectionReason;
  message?: string;
}

export type SubmitFeedResult =
  | { ok: true; feedId: string; correlationId: string }
  | { ok: false; reason: "DUPLICATE"; message: string; existingFeedId: string; correlationId: string }
  | { ok: false; reason: "SERVER_ERROR"; message: string; correlationId: string };
