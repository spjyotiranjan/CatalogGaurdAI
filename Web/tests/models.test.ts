import { describe, expect, it } from "vitest";

import { AuditLogModel } from "@/server/models/audit-log";
import { UserModel } from "@/server/models/user";

describe("Phase 1 model invariants", () => {
  it("requires seller scope for seller operators", async () => {
    const user = new UserModel({
      sellerId: null,
      fullName: "Operator",
      email: "operator@example.com",
      passwordHash: "hashed-password-value",
      role: "SELLER_OPERATOR",
      status: "ACTIVE",
    });
    await expect(user.validate()).rejects.toMatchObject({ name: "ValidationError" });
  });

  it("allows a pre-identity AUTH audit event without an entity ID", async () => {
    const event = new AuditLogModel({
      sellerId: null,
      actorType: "SYSTEM",
      actorUserId: null,
      actorService: "web-auth",
      entityType: "AUTH",
      entityId: null,
      action: "AUTHENTICATION_FAILED",
      correlationId: "4f864f99-aa42-49f5-93cd-77369c20f213",
    });
    await expect(event.validate()).resolves.toBeUndefined();
  });

  it("requires an entity ID for non-authentication audit events", async () => {
    const event = new AuditLogModel({
      sellerId: null,
      actorType: "SYSTEM",
      actorUserId: null,
      actorService: "catalogguard-web",
      entityType: "CATEGORY",
      entityId: null,
      action: "CATEGORY_CREATED",
      correlationId: "4f864f99-aa42-49f5-93cd-77369c20f213",
    });
    await expect(event.validate()).rejects.toMatchObject({ name: "ValidationError" });
  });
});
