import "server-only";

import { model, models, Schema, type InferSchemaType, type Model } from "mongoose";

export const auditActorTypes = ["USER", "SYSTEM", "AI"] as const;
export const auditEntityTypes = [
  "SELLER",
  "USER",
  "CATEGORY",
  "PRODUCT",
  "FEED",
  "REVIEW",
  "ISSUE",
  "AUTH",
] as const;

const auditLogSchema = new Schema(
  {
    sellerId: { type: Schema.Types.ObjectId, ref: "Seller", default: null },
    actorType: { type: String, enum: auditActorTypes, required: true },
    actorUserId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    actorService: { type: String, default: null },
    entityType: { type: String, enum: auditEntityTypes, required: true },
    entityId: { type: Schema.Types.ObjectId, default: null },
    action: { type: String, required: true, trim: true },
    beforeSnapshot: { type: Schema.Types.Mixed },
    afterSnapshot: { type: Schema.Types.Mixed },
    metadata: { type: Schema.Types.Mixed },
    correlationId: { type: String, required: true },
    occurredAt: { type: Date, required: true, default: Date.now },
    retentionUntil: { type: Date, default: null },
  },
  {
    collection: "audit_logs",
    timestamps: false,
    strict: "throw",
    versionKey: false,
  },
);

auditLogSchema.index(
  { entityType: 1, entityId: 1, occurredAt: -1 },
  { name: "audit_entity_occurred_at" },
);
auditLogSchema.index(
  { sellerId: 1, occurredAt: -1 },
  { name: "audit_seller_occurred_at" },
);
auditLogSchema.index(
  { correlationId: 1 },
  { name: "audit_correlation_id" },
);

auditLogSchema.pre("validate", function enforceActorConstraint() {
  const userActor = this.actorType === "USER";

  if (userActor && (!this.actorUserId || this.actorService)) {
    this.invalidate("actorUserId", "USER actors require actorUserId and no actorService");
  }

  if (!userActor && (this.actorUserId || !this.actorService)) {
    this.invalidate("actorService", "SYSTEM and AI actors require actorService and no actorUserId");
  }

  if (this.entityType !== "AUTH" && !this.entityId) {
    this.invalidate("entityId", "entityId is required outside pre-identity AUTH events");
  }
});

for (const operation of ["updateOne", "updateMany", "findOneAndUpdate", "replaceOne", "deleteOne", "deleteMany"] as const) {
  auditLogSchema.pre(operation, function rejectAuditMutation() {
    throw new Error("AUDIT_LOG is append-only");
  });
}

export type AuditLog = InferSchemaType<typeof auditLogSchema>;

export const AuditLogModel = (models.AuditLog as Model<AuditLog> | undefined) ??
  model<AuditLog>("AuditLog", auditLogSchema);

