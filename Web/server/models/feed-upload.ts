import "server-only";
import { model, models, Schema, type InferSchemaType, type Model } from "mongoose";

export const feedProcessingStatuses = ["PENDING", "DISPATCHING", "PROCESSING", "COMPLETED", "FAILED"] as const;
const feedUploadSchema = new Schema({
  sellerId: { type: Schema.Types.ObjectId, ref: "Seller", required: true }, uploadedByUserId: { type: Schema.Types.ObjectId, ref: "User", required: true }, fileName: { type: String, required: true, trim: true, maxlength: 255 }, storageObjectKey: { type: String, required: true, immutable: true, select: false }, fileType: { type: String, enum: ["CSV"], required: true }, feedType: { type: String, enum: ["PRODUCT_LISTING"], required: true }, checksum: { type: String, required: true, immutable: true, lowercase: true }, fileSizeBytes: { type: Number, required: true, immutable: true, min: 1 }, mappingVersion: { type: String, enum: ["catalog-map/v1"], required: true, immutable: true }, processingStatus: { type: String, enum: feedProcessingStatuses, required: true }, dispatchState: { type: String, enum: ["PENDING", "ACCEPTED", "FAILED"], required: true }, jobId: { type: String, required: true, immutable: true }, idempotencyKey: { type: String, required: true, immutable: true, select: false }, correlationId: { type: String, required: true, immutable: true }, totalRows: { type: Number, default: null, min: 0 }, processedRows: { type: Number, required: true, default: 0, min: 0 }, acceptedRows: { type: Number, required: true, default: 0, min: 0 }, rejectedRows: { type: Number, required: true, default: 0, min: 0 }, processedAt: { type: Date, default: null },
}, { collection: "feed_uploads", timestamps: { createdAt: "uploadedAt", updatedAt: "updatedAt" }, strict: "throw", versionKey: false });
feedUploadSchema.index({ sellerId: 1, checksum: 1 }, { unique: true, name: "feed_seller_checksum_unique" });
feedUploadSchema.index({ sellerId: 1, uploadedAt: -1, _id: -1 }, { name: "feed_seller_uploaded" });
feedUploadSchema.index({ processingStatus: 1, uploadedAt: -1 }, { name: "feed_status_uploaded" });
feedUploadSchema.index({ jobId: 1 }, { unique: true, name: "feed_job_unique" });
export type FeedUpload = InferSchemaType<typeof feedUploadSchema>;
export const FeedUploadModel = (models.FeedUpload as Model<FeedUpload> | undefined) ?? model<FeedUpload>("FeedUpload", feedUploadSchema);
