import "server-only";
import type { DatabaseMigration } from "@/server/migrations/types";
import { FeedUploadModel } from "@/server/models/feed-upload";

export const feedIntakeMigration: DatabaseMigration = { id: "005-feed-intake", description: "Create immutable seller feed uploads and Phase 2 dispatch indexes", async up(database) {
  const exists = await database.listCollections({ name: "feed_uploads" }, { nameOnly: true }).hasNext();
  const validation = { validator: { $jsonSchema: { bsonType: "object", required: ["sellerId", "uploadedByUserId", "fileName", "storageObjectKey", "fileType", "feedType", "checksum", "fileSizeBytes", "mappingVersion", "processingStatus", "dispatchState", "jobId", "idempotencyKey", "correlationId", "processedRows", "acceptedRows", "rejectedRows", "uploadedAt", "updatedAt"], properties: { sellerId: { bsonType: "objectId" }, uploadedByUserId: { bsonType: "objectId" }, fileName: { bsonType: "string" }, storageObjectKey: { bsonType: "string" }, fileType: { enum: ["CSV"] }, feedType: { enum: ["PRODUCT_LISTING"] }, checksum: { bsonType: "string", pattern: "^[a-f0-9]{64}$" }, fileSizeBytes: { bsonType: "number", minimum: 1 }, mappingVersion: { enum: ["catalog-map/v1"] }, processingStatus: { enum: ["PENDING", "DISPATCHING", "PROCESSING", "COMPLETED", "FAILED"] }, dispatchState: { enum: ["PENDING", "ACCEPTED", "FAILED"] }, jobId: { bsonType: "string" }, idempotencyKey: { bsonType: "string" }, correlationId: { bsonType: "string" } } } }, validationLevel: "strict" as const, validationAction: "error" as const };
  if (exists) await database.command({ collMod: "feed_uploads", ...validation }); else await database.createCollection("feed_uploads", validation);
  await FeedUploadModel.createIndexes();
} };
