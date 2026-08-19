import { z } from "zod";

const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i);
const sha256Schema = z.string().regex(/^[a-f\d]{64}$/);

export const feedProcessingStatusSchema = z.enum(["PENDING", "DISPATCHING", "PROCESSING", "COMPLETED", "FAILED"]);
export const feedSummarySchema = z.object({
  id: objectIdSchema, fileName: z.string().min(1).max(255), fileType: z.literal("CSV"), feedType: z.literal("PRODUCT_LISTING"), processingStatus: feedProcessingStatusSchema, checksum: sha256Schema, mappingVersion: z.literal("catalog-map/v1"), totalRows: z.number().int().nonnegative().nullable(), processedRows: z.number().int().nonnegative(), acceptedRows: z.number().int().nonnegative(), rejectedRows: z.number().int().nonnegative(), uploadedAt: z.iso.datetime(), processedAt: z.iso.datetime().nullable(), correlationId: z.uuid(), canDownload: z.boolean(), nextAction: z.enum(["WAIT", "VIEW_RESULTS", "RETRY_CONTACT_SUPPORT"]),
}).strict();
export const feedDetailSchema = feedSummarySchema.extend({ jobId: z.uuid(), dispatchState: z.enum(["PENDING", "ACCEPTED", "FAILED"]), sourceIntegrity: z.object({ checksum: sha256Schema, fileSizeBytes: z.number().int().positive() }).strict(), timeline: z.array(z.object({ stage: z.string().min(1).max(80), occurredAt: z.iso.datetime().nullable(), complete: z.boolean() }).strict()) }).strict();
export const createFeedResponseSchema = z.object({ data: feedDetailSchema }).strict();
export const feedListResponseSchema = z.object({ data: z.array(feedSummarySchema), nextCursor: z.string().nullable() }).strict();
export const feedDetailResponseSchema = z.object({ data: feedDetailSchema }).strict();
export const feedDownloadResponseSchema = z.object({ data: z.object({ url: z.url(), expiresAt: z.iso.datetime() }).strict() }).strict();
export type FeedDetail = z.infer<typeof feedDetailSchema>;
