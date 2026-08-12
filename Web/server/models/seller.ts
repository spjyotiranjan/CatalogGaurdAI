import "server-only";

import { model, models, Schema, type InferSchemaType, type Model } from "mongoose";

export const sellerStatuses = ["ACTIVE", "INACTIVE", "SUSPENDED"] as const;

const sellerSchema = new Schema(
  {
    sellerCode: { type: String, required: true, trim: true, uppercase: true },
    businessName: { type: String, required: true, trim: true },
    displayName: { type: String, trim: true },
    contactEmail: { type: String, required: true, trim: true, lowercase: true },
    contactPhone: { type: String, trim: true },
    status: { type: String, enum: sellerStatuses, required: true },
  },
  {
    collection: "sellers",
    timestamps: true,
    strict: "throw",
  },
);

sellerSchema.index({ sellerCode: 1 }, { unique: true, name: "seller_code_unique" });
sellerSchema.index({ contactEmail: 1 }, { name: "seller_contact_email" });
sellerSchema.index({ status: 1 }, { name: "seller_status" });

export type Seller = InferSchemaType<typeof sellerSchema>;

export const SellerModel = (models.Seller as Model<Seller> | undefined) ??
  model<Seller>("Seller", sellerSchema);

