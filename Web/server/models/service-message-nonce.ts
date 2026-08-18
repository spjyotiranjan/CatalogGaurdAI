import "server-only";

import { model, models, Schema, type InferSchemaType, type Model } from "mongoose";

const serviceMessageNonceSchema = new Schema(
  {
    serviceId: { type: String, required: true, trim: true },
    keyVersion: { type: String, required: true, trim: true },
    nonce: { type: String, required: true, trim: true, lowercase: true },
    receivedAt: { type: Date, required: true, default: Date.now },
    expiresAt: { type: Date, required: true },
  },
  { collection: "service_message_nonces", strict: "throw", versionKey: false },
);

serviceMessageNonceSchema.index(
  { serviceId: 1, keyVersion: 1, nonce: 1 },
  { name: "service_message_nonce_unique", unique: true },
);
serviceMessageNonceSchema.index({ expiresAt: 1 }, { name: "service_message_nonce_expiry", expireAfterSeconds: 0 });

export type ServiceMessageNonce = InferSchemaType<typeof serviceMessageNonceSchema>;
export const ServiceMessageNonceModel =
  (models.ServiceMessageNonce as Model<ServiceMessageNonce> | undefined) ??
  model<ServiceMessageNonce>("ServiceMessageNonce", serviceMessageNonceSchema);
