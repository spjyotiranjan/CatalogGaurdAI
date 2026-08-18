import "server-only";

import type { Db, Document } from "mongodb";

import { AuditLogModel } from "@/server/models/audit-log";
import { CategoryModel } from "@/server/models/category";
import { SellerModel } from "@/server/models/seller";
import { UserModel } from "@/server/models/user";
import type { DatabaseMigration } from "@/server/migrations/types";

async function ensureValidatedCollection(
  database: Db,
  collectionName: string,
  jsonSchema: Document,
): Promise<void> {
  const exists = await database
    .listCollections({ name: collectionName }, { nameOnly: true })
    .hasNext();
  const validation = {
    validator: { $jsonSchema: jsonSchema },
    validationLevel: "strict" as const,
    validationAction: "error" as const,
  };

  if (exists) {
    await database.command({ collMod: collectionName, ...validation });
  } else {
    await database.createCollection(collectionName, validation);
  }
}

const timestampProperties = {
  createdAt: { bsonType: "date" },
  updatedAt: { bsonType: "date" },
};

export const phaseOneFoundationMigration: DatabaseMigration = {
  id: "001-phase-one-foundation",
  description: "Create validated Phase 1 collections and required indexes",
  async up(database) {
    await ensureValidatedCollection(database, "sellers", {
      bsonType: "object",
      required: [
        "sellerCode",
        "businessName",
        "contactEmail",
        "status",
        "createdAt",
        "updatedAt",
      ],
      properties: {
        sellerCode: { bsonType: "string", minLength: 1 },
        businessName: { bsonType: "string", minLength: 1 },
        displayName: { bsonType: ["string", "null"] },
        contactEmail: { bsonType: "string", minLength: 3 },
        contactPhone: { bsonType: ["string", "null"] },
        status: { enum: ["ACTIVE", "INACTIVE", "SUSPENDED"] },
        ...timestampProperties,
      },
    });

    await ensureValidatedCollection(database, "users", {
      bsonType: "object",
      required: [
        "sellerId",
        "fullName",
        "email",
        "passwordHash",
        "role",
        "status",
        "createdAt",
        "updatedAt",
      ],
      properties: {
        sellerId: { bsonType: ["objectId", "null"] },
        fullName: { bsonType: "string", minLength: 1 },
        email: { bsonType: "string", pattern: "^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$" },
        passwordHash: { bsonType: "string", minLength: 20 },
        role: { enum: ["ADMIN", "CATALOG_REVIEWER", "SELLER_OPERATOR"] },
        status: { enum: ["ACTIVE", "INVITED", "DISABLED"] },
        lastLoginAt: { bsonType: ["date", "null"] },
        ...timestampProperties,
      },
      oneOf: [
        {
          properties: {
            role: { enum: ["SELLER_OPERATOR"] },
            sellerId: { bsonType: "objectId" },
          },
        },
        {
          properties: {
            role: { enum: ["ADMIN", "CATALOG_REVIEWER"] },
            sellerId: { bsonType: "null" },
          },
        },
      ],
    });

    await ensureValidatedCollection(database, "categories", {
      bsonType: "object",
      required: [
        "parentCategoryId",
        "name",
        "slug",
        "taxonomyPath",
        "level",
        "isLeaf",
        "status",
        "createdAt",
        "updatedAt",
      ],
      properties: {
        parentCategoryId: { bsonType: ["objectId", "null"] },
        name: { bsonType: "string", minLength: 1 },
        slug: { bsonType: "string", minLength: 1 },
        taxonomyPath: { bsonType: "array", items: { bsonType: "string" } },
        level: { bsonType: ["int", "long", "double", "decimal"], minimum: 0 },
        attributeSchema: { bsonType: ["object", "array", "null"] },
        isLeaf: { bsonType: "bool" },
        status: { enum: ["ACTIVE", "DISABLED"] },
        ...timestampProperties,
      },
    });

    await ensureValidatedCollection(database, "audit_logs", {
      bsonType: "object",
      required: [
        "sellerId",
        "actorType",
        "actorUserId",
        "actorService",
        "entityType",
        "entityId",
        "action",
        "correlationId",
        "occurredAt",
      ],
      properties: {
        sellerId: { bsonType: ["objectId", "null"] },
        actorType: { enum: ["USER", "SYSTEM", "AI"] },
        actorUserId: { bsonType: ["objectId", "null"] },
        actorService: { bsonType: ["string", "null"] },
        entityType: {
          enum: [
            "SELLER",
            "USER",
            "CATEGORY",
            "PRODUCT",
            "FEED",
            "REVIEW",
            "ISSUE",
            "AUTH",
          ],
        },
        entityId: { bsonType: ["objectId", "null"] },
        action: { bsonType: "string", minLength: 1 },
        beforeSnapshot: {},
        afterSnapshot: {},
        metadata: {},
        correlationId: { bsonType: "string" },
        occurredAt: { bsonType: "date" },
        retentionUntil: { bsonType: ["date", "null"] },
      },
    });

    await Promise.all([
      SellerModel.createIndexes(),
      UserModel.createIndexes(),
      CategoryModel.createIndexes(),
      AuditLogModel.createIndexes(),
    ]);
  },
};
