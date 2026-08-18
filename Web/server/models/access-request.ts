import "server-only";

import { model, models, Schema, type InferSchemaType, type Model } from "mongoose";

import { accessRequestRoleSchema, accessRequestStatusSchema } from "@/lib/contracts/access-requests";

const accessRequestSchema = new Schema({
  role: { type: String, enum: accessRequestRoleSchema.options, required: true },
  fullName: { type: String, required: true, trim: true },
  email: { type: String, required: true, trim: true, lowercase: true },
  passwordHash: { type: String, required: true, select: false },
  proposal: { type: String, required: true, trim: true },
  businessName: { type: String, default: null, trim: true },
  contactPhone: { type: String, default: null, trim: true },
  status: { type: String, enum: accessRequestStatusSchema.options, required: true, default: "PENDING" },
  decidedByUserId: { type: Schema.Types.ObjectId, ref: "User", default: null },
  decidedAt: { type: Date, default: null },
  decisionReason: { type: String, default: null, trim: true },
  dismissedByUserIds: [{ type: Schema.Types.ObjectId, ref: "User" }],
}, { collection: "access_requests", timestamps: true, strict: "throw" });

accessRequestSchema.index({ email: 1, status: 1 }, { name: "access_request_email_status" });
accessRequestSchema.index({ status: 1, createdAt: -1 }, { name: "access_request_status_created" });
accessRequestSchema.index({ dismissedByUserIds: 1, status: 1 }, { name: "access_request_dismissed_status" });

export type AccessRequest = InferSchemaType<typeof accessRequestSchema>;
export const AccessRequestModel = (models.AccessRequest as Model<AccessRequest> | undefined) ?? model<AccessRequest>("AccessRequest", accessRequestSchema);
