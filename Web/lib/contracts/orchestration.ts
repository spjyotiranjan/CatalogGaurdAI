import { z } from "zod";

const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i);
const sha256Schema = z.string().regex(/^[a-f\d]{64}$/);
const nonEmptyString = (maximum: number) => z.string().min(1).max(maximum);
const jsonValueSchema = z.json();

export const orchestrationCallbackPath = "/api/internal/validation-results";

export const validationJobRequestSchema = z
  .object({
    contractVersion: z.literal("v1"),
    jobId: z.uuid(),
    idempotencyKey: nonEmptyString(128),
    feed: z
      .object({
        feedUploadId: objectIdSchema,
        sellerId: objectIdSchema,
        fileType: z.literal("CSV"),
        feedType: z.literal("PRODUCT_LISTING"),
        checksum: sha256Schema,
        storageObjectKey: nonEmptyString(512).regex(/^[^\x00-\x1f]+$/),
        mappingVersion: z.literal("catalog-map/v1"),
      })
      .strict(),
    execution: z
      .object({
        correlationId: z.uuid(),
        actorType: z.literal("SYSTEM"),
        actorService: nonEmptyString(80),
      })
      .strict(),
  })
  .strict();

const normalizedProductCandidateSchema = z
  .object({
    externalProductId: nonEmptyString(128),
    sku: nonEmptyString(128),
    title: nonEmptyString(500),
    description: z.string().max(10_000).nullable().optional(),
    categoryId: objectIdSchema.nullable().optional(),
    currency: z.string().regex(/^[A-Z]{3}$/).nullable().optional(),
    listPrice: z.string().regex(/^(?!^[-+.]*$)[+-]?0*(?:\d{0,15}|(?=[\d.]{1,20}0*$)\d{0,15}\.\d{0,4}0*$)/).nullable().optional(),
    salePrice: z.string().regex(/^(?!^[-+.]*$)[+-]?0*(?:\d{0,15}|(?=[\d.]{1,20}0*$)\d{0,15}\.\d{0,4}0*$)/).nullable().optional(),
    stockQuantity: z.number().int().nonnegative().nullable().optional(),
    reservedQuantity: z.number().int().nonnegative().nullable().optional(),
    attributes: z.record(z.string(), jsonValueSchema).refine(
      (value) => Object.keys(value).length <= 100,
      "Attributes cannot contain more than 100 values.",
    ).optional(),
  })
  .strict();

const validationFindingSchema = z
  .object({
    ruleId: nonEmptyString(100),
    ruleVersion: nonEmptyString(40),
    fieldPath: nonEmptyString(256),
    issueType: z.enum(["MISSING", "INVALID", "INCONSISTENT", "DUPLICATE"]),
    severity: z.enum(["INFO", "WARNING", "ERROR", "BLOCKER"]),
    message: nonEmptyString(500),
    detectedValue: jsonValueSchema.nullable().optional(),
    expectedValue: jsonValueSchema.nullable().optional(),
    suggestedValue: jsonValueSchema.nullable().optional(),
  })
  .strict();

const aiAdvisorySchema = z
  .object({
    advisoryType: z.literal("CATEGORY_CHECK"),
    status: z.enum(["COMPLETED", "FAILED", "SKIPPED"]),
    consistent: z.boolean().nullable().optional(),
    suggestedCategoryId: objectIdSchema.nullable().optional(),
    suggestion: z.string().max(500).nullable().optional(),
    confidence: z.string().regex(/^(?!^[-+.]*$)[+-]?0*(?:\d{0,1}|(?=[\d.]{1,6}0*$)\d{0,1}\.\d{0,4}0*$)/).nullable().optional(),
    evidence: z.array(z.string()).max(5).optional(),
    provider: z.string().max(80).nullable().optional(),
    model: z.string().max(120).nullable().optional(),
    promptVersion: z.string().max(80).nullable().optional(),
    inputSnapshotHash: sha256Schema.nullable().optional(),
    latencyMs: z.number().int().nonnegative().nullable().optional(),
    usage: z
      .object({
        inputTokens: z.number().int().nonnegative(),
        outputTokens: z.number().int().nonnegative(),
        costMicrounits: z.number().int().nonnegative().nullable().optional(),
      })
      .strict()
      .nullable()
      .optional(),
    failureReason: z.string().max(120).nullable().optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.status === "COMPLETED") {
      for (const key of ["consistent", "suggestion", "confidence", "provider", "model", "promptVersion", "inputSnapshotHash"] as const) {
        if (value[key] == null) context.addIssue({ code: "custom", path: [key], message: "Completed advisory metadata is required." });
      }
      if (!value.evidence?.length) context.addIssue({ code: "custom", path: ["evidence"], message: "Completed advisory requires evidence." });
    } else if (!value.failureReason) {
      context.addIssue({ code: "custom", path: ["failureReason"], message: "Failed or skipped advisory requires a safe failure reason." });
    }
  });

const recordValidationResultSchema = z
  .object({
    sourceRowNumber: z.number().int().min(1),
    candidateIdentity: nonEmptyString(256),
    sourceProductId: z.string().max(128).nullable().optional(),
    outcome: z.enum(["ACCEPTED", "REJECTED", "FAILED"]),
    normalizedCandidate: normalizedProductCandidateSchema.nullable().optional(),
    ruleSetVersion: nonEmptyString(80),
    issues: z.array(validationFindingSchema).max(200).optional(),
    aiAdvisory: aiAdvisorySchema.nullable().optional(),
    errorSummary: z.string().max(500).nullable().optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.outcome === "ACCEPTED" && !value.normalizedCandidate) context.addIssue({ code: "custom", path: ["normalizedCandidate"], message: "Accepted records require a normalized candidate." });
    if (value.outcome === "FAILED" && !value.errorSummary) context.addIssue({ code: "custom", path: ["errorSummary"], message: "Failed records require a safe error summary." });
  });

export const validationJobResultSchema = z
  .object({
    contractVersion: z.literal("v1"),
    jobId: z.uuid(),
    feedUploadId: objectIdSchema,
    sellerId: objectIdSchema,
    checksum: sha256Schema,
    idempotencyKey: nonEmptyString(128),
    outcome: z.enum(["COMPLETED", "FAILED", "CANCELLED"]),
    summary: z
      .object({
        totalRows: z.number().int().nonnegative(),
        processedRows: z.number().int().nonnegative(),
        acceptedRows: z.number().int().nonnegative(),
        rejectedRows: z.number().int().nonnegative(),
      })
      .strict(),
    records: z.array(recordValidationResultSchema).max(1_000),
    execution: z
      .object({
        correlationId: z.uuid(),
        actorType: z.literal("SYSTEM"),
        actorService: nonEmptyString(80),
      })
      .strict(),
  })
  .strict()
  .superRefine((value, context) => {
    const { summary } = value;
    if (summary.processedRows > summary.totalRows) context.addIssue({ code: "custom", path: ["summary", "processedRows"], message: "Processed rows cannot exceed total rows." });
    if (summary.acceptedRows + summary.rejectedRows !== summary.processedRows) context.addIssue({ code: "custom", path: ["summary"], message: "Accepted and rejected rows must equal processed rows." });
    if (value.records.length !== summary.processedRows) context.addIssue({ code: "custom", path: ["records"], message: "Records must equal processed rows." });
    if (value.outcome === "COMPLETED" && summary.processedRows !== summary.totalRows) context.addIssue({ code: "custom", path: ["summary"], message: "Completed results must account for every row." });
  });

export type ValidationJobRequest = z.infer<typeof validationJobRequestSchema>;
export type ValidationJobResult = z.infer<typeof validationJobResultSchema>;
