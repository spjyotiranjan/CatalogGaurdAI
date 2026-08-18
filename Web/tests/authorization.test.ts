import { describe, expect, it, vi } from "vitest";

import { AuthorizationService } from "@/server/auth/authorization";
import type { AuthorizationUser } from "@/server/repositories/user-repository";

const correlationId = "4f864f99-aa42-49f5-93cd-77369c20f213";
const userId = "66bb4f8b683bb83a83c26111";
const sellerId = "66bb4f8b683bb83a83c26222";

function repositoryReturning(user: AuthorizationUser | null) {
  return { findActiveById: vi.fn().mockResolvedValue(user) };
}

const sellerOperator: AuthorizationUser = {
  id: userId,
  sellerId,
  fullName: "Seller Operator",
  email: "operator@example.com",
  role: "SELLER_OPERATOR",
  status: "ACTIVE",
};

describe("AuthorizationService", () => {
  it("rejects unauthenticated access", async () => {
    const service = new AuthorizationService(repositoryReturning(sellerOperator));
    await expect(
      service.authorize({ session: null, correlationId }),
    ).rejects.toMatchObject({
      code: "AUTHENTICATION_REQUIRED",
      status: 401,
    });
  });

  it("rejects a disabled or missing current user despite a session identity", async () => {
    const service = new AuthorizationService(repositoryReturning(null));
    await expect(
      service.authorize({ session: { userId }, correlationId }),
    ).rejects.toMatchObject({ code: "SESSION_INACTIVE", status: 401 });
  });

  it("rejects a role that is not allowed", async () => {
    const service = new AuthorizationService(repositoryReturning(sellerOperator));
    await expect(
      service.authorize({
        session: { userId },
        correlationId,
        allowedRoles: ["ADMIN"],
      }),
    ).rejects.toMatchObject({
      code: "AUTHORIZATION_DENIED",
      status: 403,
    });
  });

  it("rejects a seller operator crossing seller scope", async () => {
    const service = new AuthorizationService(repositoryReturning(sellerOperator));
    await expect(
      service.authorize({
        session: { userId },
        correlationId,
        requestedSellerId: "66bb4f8b683bb83a83c26333",
      }),
    ).rejects.toMatchObject({
      code: "TENANT_SCOPE_DENIED",
      status: 403,
    });
  });

  it("derives role and seller scope from the current database user", async () => {
    const service = new AuthorizationService(repositoryReturning(sellerOperator));
    const authorized = await service.authorize({
      session: { userId },
      correlationId,
      allowedRoles: ["SELLER_OPERATOR"],
      requestedSellerId: sellerId,
    });
    expect(authorized.context).toMatchObject({
      actorUserId: userId,
      role: "SELLER_OPERATOR",
      sellerId,
      correlationId,
    });
  });
});
