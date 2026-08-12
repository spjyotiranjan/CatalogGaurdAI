import "server-only";

import { model, models, Schema, type InferSchemaType, type Model } from "mongoose";

import { userRoleSchema, userStatusSchema } from "@/lib/contracts/auth";

const userSchema = new Schema(
  {
    sellerId: { type: Schema.Types.ObjectId, ref: "Seller", default: null },
    fullName: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: userRoleSchema.options, required: true },
    status: { type: String, enum: userStatusSchema.options, required: true },
    lastLoginAt: { type: Date, default: null },
  },
  {
    collection: "users",
    timestamps: true,
    strict: "throw",
  },
);

userSchema.index({ email: 1 }, { unique: true, name: "user_email_unique" });
userSchema.index({ sellerId: 1, status: 1 }, { name: "user_seller_status" });
userSchema.index({ role: 1, status: 1 }, { name: "user_role_status" });

userSchema.pre("validate", function enforceRoleScope() {
  if (this.role === "SELLER_OPERATOR" && !this.sellerId) {
    this.invalidate("sellerId", "SELLER_OPERATOR requires a sellerId");
  }

  if (this.role !== "SELLER_OPERATOR" && this.sellerId) {
    this.invalidate("sellerId", `${this.role} must not have a sellerId`);
  }
});

export type User = InferSchemaType<typeof userSchema>;

export const UserModel = (models.User as Model<User> | undefined) ??
  model<User>("User", userSchema);

