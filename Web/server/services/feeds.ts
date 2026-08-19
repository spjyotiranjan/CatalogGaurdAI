import "server-only";
import { randomUUID } from "node:crypto";
import mongoose from "mongoose";
import { z } from "zod";
import { AppError } from "@/lib/contracts/errors";
import type { FeedDetail } from "@/lib/contracts/feeds";
import { validationJobRequestSchema } from "@/lib/contracts/orchestration";
import type { SessionIdentity } from "@/server/auth/authorization";
import { authorizationService } from "@/server/auth/authorization";
import { assertSameOrigin } from "@/server/auth/csrf";
import { auditLogRepository } from "@/server/repositories/audit-log-repository";
import { feedUploadRepository, type FeedRecord } from "@/server/repositories/feed-upload-repository";
import { assertPrivateObject, checksumBytes, createFeedObjectKey, createPrivateDownloadUrl, putPrivateCsv } from "@/server/integrations/storage/r2";
import { getOrchestrationBridgeEnvironment } from "@/server/config/env";
import { orchestrationSigningHeaders, signOrchestrationMessage } from "@/server/integrations/orchestration/signing";

const pageSize = 25;
const fileNameSchema = z.string().trim().min(1).max(255).transform((value) => value.replace(/[\\/:*?"<>|\u0000-\u001f]+/g, "-").replace(/\s+/g, " "));

function view(row: FeedRecord): FeedDetail {
  const terminal = row.processingStatus === "COMPLETED" || row.processingStatus === "FAILED";
  return { id: row.id, fileName: row.fileName, fileType: row.fileType, feedType: row.feedType, processingStatus: row.processingStatus, checksum: row.checksum, mappingVersion: row.mappingVersion, totalRows: row.totalRows, processedRows: row.processedRows, acceptedRows: row.acceptedRows, rejectedRows: row.rejectedRows, uploadedAt: row.uploadedAt.toISOString(), processedAt: row.processedAt?.toISOString() ?? null, correlationId: row.correlationId, canDownload: true, nextAction: row.processingStatus === "COMPLETED" ? "VIEW_RESULTS" : row.processingStatus === "FAILED" ? "RETRY_CONTACT_SUPPORT" : "WAIT", jobId: row.jobId, dispatchState: row.dispatchState, sourceIntegrity: { checksum: row.checksum, fileSizeBytes: row.fileSizeBytes }, timeline: [ { stage: "Uploaded privately", occurredAt: row.uploadedAt.toISOString(), complete: true }, { stage: "Validation job accepted", occurredAt: row.dispatchState === "ACCEPTED" ? row.uploadedAt.toISOString() : null, complete: row.dispatchState === "ACCEPTED" }, { stage: "Processing", occurredAt: row.processingStatus === "PROCESSING" || terminal ? row.uploadedAt.toISOString() : null, complete: terminal }, { stage: "Results available", occurredAt: row.processedAt?.toISOString() ?? null, complete: row.processingStatus === "COMPLETED" } ] };
}

function validateCsv(file: File, bytes: Uint8Array, maximum: number): string {
  const name = fileNameSchema.parse(file.name);
  if (!name.toLowerCase().endsWith(".csv") || file.type && !["text/csv", "application/csv", "text/plain"].includes(file.type)) throw new AppError({ code: "FILE_REJECTED", message: "Choose a CSV file.", status: 400, fieldErrors: { file: ["Only CSV files are supported."] } });
  if (bytes.byteLength > maximum) throw new AppError({ code: "FILE_REJECTED", message: "The CSV exceeds the upload size limit.", status: 413, fieldErrors: { file: ["Choose a smaller CSV file."] } });
  const sample = new TextDecoder("utf-8", { fatal: true }).decode(bytes.subarray(0, Math.min(bytes.length, 16_384)));
  if (!sample.includes("\n") || !sample.split(/\r?\n/, 1)[0]?.includes(",") || sample.includes("\u0000")) throw new AppError({ code: "FILE_REJECTED", message: "The CSV structure could not be recognized.", status: 400, fieldErrors: { file: ["Include a comma-separated header row and at least one data row."] } });
  return name;
}

async function dispatch(row: FeedRecord): Promise<void> {
  const environment = getOrchestrationBridgeEnvironment();
  if (!environment) throw new AppError({ code: "DEPENDENCY_UNAVAILABLE", message: "Validation dispatch is not configured.", status: 503, retryable: true });
  const job = validationJobRequestSchema.parse({ contractVersion: "v1", jobId: row.jobId, idempotencyKey: row.idempotencyKey, feed: { feedUploadId: row.id, sellerId: row.sellerId, fileType: "CSV", feedType: "PRODUCT_LISTING", checksum: row.checksum, storageObjectKey: row.storageObjectKey, mappingVersion: row.mappingVersion }, execution: { correlationId: row.correlationId, actorType: "SYSTEM", actorService: environment.ORCHESTRATION_WEB_SERVICE_ID } });
  const body = new TextEncoder().encode(JSON.stringify(job)); const timestamp = Math.floor(Date.now() / 1000); const nonce = randomUUID(); const path = "/internal/v1/jobs";
  const headers = new Headers({ "content-type": "application/json", "x-correlation-id": row.correlationId, [orchestrationSigningHeaders.keyVersion]: environment.ORCHESTRATION_WEB_SERVICE_KEY_VERSION, [orchestrationSigningHeaders.service]: environment.ORCHESTRATION_WEB_SERVICE_ID, [orchestrationSigningHeaders.timestamp]: String(timestamp), [orchestrationSigningHeaders.nonce]: nonce });
  headers.set(orchestrationSigningHeaders.signature, signOrchestrationMessage({ secret: environment.ORCHESTRATION_WEB_SERVICE_SECRET, keyVersion: environment.ORCHESTRATION_WEB_SERVICE_KEY_VERSION, serviceId: environment.ORCHESTRATION_WEB_SERVICE_ID, timestamp, nonce, method: "POST", path, body }));
  let response: Response; try { response = await fetch(new URL(path, environment.ORCHESTRATION_BASE_URL), { method: "POST", headers, body, signal: AbortSignal.timeout(10_000), cache: "no-store" }); } catch (cause) { throw new AppError({ code: "FEED_DISPATCH_FAILED", message: "The feed was stored, but validation could not be started.", status: 503, retryable: true, cause }); }
  if (response.status !== 202) throw new AppError({ code: "FEED_DISPATCH_FAILED", message: "The feed was stored, but validation could not be started.", status: 503, retryable: true });
}

export class FeedService {
  async create(request: Request, session: SessionIdentity, correlationId: string): Promise<FeedDetail> {
    assertSameOrigin(request); const { context } = await authorizationService.authorize({ session, correlationId, allowedRoles: ["SELLER_OPERATOR"] }); if (!context.sellerId) throw new AppError({ code: "TENANT_SCOPE_DENIED", message: "A seller scope is required.", status: 403 });
    const form = await request.formData(); const file = form.get("file"); if (!(file instanceof File)) throw new AppError({ code: "FILE_REJECTED", message: "Choose a CSV file to upload.", status: 400, fieldErrors: { file: ["A CSV file is required."] } });
    const bytes = new Uint8Array(await file.arrayBuffer()); const maximum = (await import("@/server/config/env")).getEnvironment().R2_MAX_UPLOAD_BYTES; const fileName = validateCsv(file, bytes, maximum); const checksum = checksumBytes(bytes); const id = new mongoose.Types.ObjectId().toString(); const rowInput = { sellerId: context.sellerId, uploadedByUserId: context.actorUserId, fileName, storageObjectKey: createFeedObjectKey(context.sellerId, id), fileType: "CSV" as const, feedType: "PRODUCT_LISTING" as const, checksum, fileSizeBytes: bytes.byteLength, mappingVersion: "catalog-map/v1" as const, processingStatus: "PENDING" as const, dispatchState: "PENDING" as const, jobId: randomUUID(), idempotencyKey: `feed-validation:${id}`, correlationId };
    let row: FeedRecord; const dbSession = await mongoose.startSession(); try { await dbSession.withTransaction(async () => { row = await feedUploadRepository.create(rowInput, dbSession); await auditLogRepository.append({ context, entityType: "FEED", entityId: row.id, sellerId: context.sellerId, action: "FEED_UPLOAD_CREATED", metadata: { fileName, checksum, fileSizeBytes: bytes.byteLength, mappingVersion: row.mappingVersion }, session: dbSession }); }); } catch (error) { if (typeof error === "object" && error && "code" in error && error.code === 11000) throw new AppError({ code: "DUPLICATE_UPLOAD", message: "This CSV was already submitted for this seller.", status: 409, fieldErrors: { file: ["Upload a changed CSV or open the existing feed in history."] } }); throw error; } finally { await dbSession.endSession(); }
    try { await putPrivateCsv({ key: row!.storageObjectKey, body: bytes, checksum }); await assertPrivateObject({ key: row!.storageObjectKey, size: bytes.byteLength, checksum }); await dispatch(row!); await feedUploadRepository.markDispatch(row!.id, "ACCEPTED"); } catch (error) { await feedUploadRepository.markDispatch(row!.id, "FAILED"); throw error; }
    return view((await feedUploadRepository.getScoped(row!.id, context.sellerId))!);
  }
  async list(session: SessionIdentity, correlationId: string, cursor?: string) { const { context } = await authorizationService.authorize({ session, correlationId, allowedRoles: ["SELLER_OPERATOR"] }); const records = await feedUploadRepository.listScoped(context.sellerId!, cursor, pageSize + 1); const visible = records.slice(0, pageSize); return { data: visible.map((row) => { const detail = view(row); return { id: detail.id, fileName: detail.fileName, fileType: detail.fileType, feedType: detail.feedType, processingStatus: detail.processingStatus, checksum: detail.checksum, mappingVersion: detail.mappingVersion, totalRows: detail.totalRows, processedRows: detail.processedRows, acceptedRows: detail.acceptedRows, rejectedRows: detail.rejectedRows, uploadedAt: detail.uploadedAt, processedAt: detail.processedAt, correlationId: detail.correlationId, canDownload: detail.canDownload, nextAction: detail.nextAction }; }), nextCursor: records.length > pageSize ? visible.at(-1)?.id ?? null : null }; }
  async detail(session: SessionIdentity, correlationId: string, id: string) { const { context } = await authorizationService.authorize({ session, correlationId, allowedRoles: ["SELLER_OPERATOR"] }); const row = await feedUploadRepository.getScoped(id, context.sellerId!); if (!row) throw new AppError({ code: "FEED_NOT_FOUND", message: "The feed was not found.", status: 404 }); return view(row); }
  async download(session: SessionIdentity, correlationId: string, id: string) { const { context } = await authorizationService.authorize({ session, correlationId, allowedRoles: ["SELLER_OPERATOR"] }); const row = await feedUploadRepository.getScoped(id, context.sellerId!); if (!row) throw new AppError({ code: "FEED_NOT_FOUND", message: "The feed was not found.", status: 404 }); const download = await createPrivateDownloadUrl(row.storageObjectKey); return { url: download.url, expiresAt: download.expiresAt.toISOString() }; }
}
export const feedService = new FeedService();
