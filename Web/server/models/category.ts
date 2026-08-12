import "server-only";

import { model, models, Schema, type InferSchemaType, type Model } from "mongoose";

export const categoryStatuses = ["ACTIVE", "DISABLED"] as const;

const categorySchema = new Schema(
  {
    parentCategoryId: { type: Schema.Types.ObjectId, ref: "Category", default: null },
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, trim: true, lowercase: true },
    taxonomyPath: { type: [String], required: true },
    level: { type: Number, required: true, min: 0 },
    attributeSchema: { type: Schema.Types.Mixed },
    isLeaf: { type: Boolean, required: true },
    status: { type: String, enum: categoryStatuses, required: true },
  },
  {
    collection: "categories",
    timestamps: true,
    strict: "throw",
  },
);

categorySchema.index({ slug: 1 }, { unique: true, name: "category_slug_unique" });
categorySchema.index({ parentCategoryId: 1, name: 1 }, { unique: true, name: "category_parent_name_unique" });
categorySchema.index({ parentCategoryId: 1, status: 1 }, { name: "category_parent_status" });

export type Category = InferSchemaType<typeof categorySchema>;

export const CategoryModel = (models.Category as Model<Category> | undefined) ??
  model<Category>("Category", categorySchema);

