import "server-only";

import { createHash } from "node:crypto";

import type { AccessRequestSummary } from "@/lib/contracts/access-requests";
import { AppError } from "@/lib/contracts/errors";
import { hashPassword } from "@/server/auth/passwords";
import { authorizationService, type SessionIdentity } from "@/server/auth/authorization";
import { withMongoTransaction } from "@/server/db/transaction";
import { auditLogRepository } from "@/server/repositories/audit-log-repository";
import { accessRequestRepository } from "@/server/repositories/access-request-repository";
import { sellerRepository } from "@/server/repositories/seller-repository";
import { userRepository } from "@/server/repositories/user-repository";

type AccessRequestSubmission = {
  role: AccessRequestSummary["role"];
  fullName: string;
  email: string;
  password: string;
  proposal: string;
  businessName?: string;
  contactPhone?: string;
};

/** Removes the plaintext credential before handing a request to persistence. */
export function toAccessRequestPersistenceInput(input: AccessRequestSubmission) {
  const { password, ...request } = input;
  void password;
  return request;
}

export class AccessRequestService {
  async submit(input: AccessRequestSubmission, correlationId: string): Promise<string> {
    if (await accessRequestRepository.hasPendingForEmail(input.email) || await userRepository.findForAuthenticationByEmail(input.email)) {
      throw new AppError({ code: "CONFLICT", message: "An access request or account already exists for this email.", status: 409 });
    }
    const id = await accessRequestRepository.create({
      ...toAccessRequestPersistenceInput(input),
      passwordHash: await hashPassword(input.password),
    });
    await auditLogRepository.append({ context: { correlationId, actorType: "SYSTEM", actorUserId: null, actorService: "web-public", role: null, sellerId: null }, entityType: "ACCESS_REQUEST", entityId: id, action: "ACCESS_REQUEST_SUBMITTED", metadata: { role: input.role, emailFingerprint: createHash("sha256").update(input.email.trim().toLowerCase()).digest("hex") } });
    return id;
  }

  async list(session: SessionIdentity, correlationId: string): Promise<AccessRequestSummary[]> {
    const { context } = await authorizationService.authorize({ session, correlationId, allowedRoles: ["ADMIN"] });
    return accessRequestRepository.list(context.actorUserId);
  }

  async decide(session: SessionIdentity, correlationId: string, id: string, outcome: "APPROVED" | "REVOKED", reason?: string): Promise<void> {
    const { context } = await authorizationService.authorize({ session, correlationId, allowedRoles: ["ADMIN"] });
    await withMongoTransaction(async (databaseSession) => {
      const decisionReason = reason?.trim() || null;
      const request = await accessRequestRepository.decidePending(id, { status: outcome, adminUserId: context.actorUserId, reason: decisionReason }, databaseSession);
      if (!request) throw new AppError({ code: "CONFLICT", message: "This request is no longer pending.", status: 409 });
      let sellerId: string | null = null;
      if (outcome === "APPROVED") {
        if (request.role === "SELLER_OPERATOR") {
          const seller = await sellerRepository.create({ sellerCode: `SELL-${request._id.toString().slice(-8).toUpperCase()}`, businessName: request.businessName ?? request.fullName, contactEmail: request.email, contactPhone: request.contactPhone ?? undefined, status: "ACTIVE" }, databaseSession);
          sellerId = seller.id;
        }
        await userRepository.create({ sellerId, fullName: request.fullName, email: request.email, passwordHash: request.passwordHash ?? "", role: request.role, status: "ACTIVE" }, databaseSession);
      }
      await auditLogRepository.append({ context, entityType: "ACCESS_REQUEST", entityId: request._id.toString(), sellerId, action: outcome === "APPROVED" ? "ACCESS_REQUEST_APPROVED" : "ACCESS_REQUEST_REVOKED", metadata: { role: request.role, reason: decisionReason }, session: databaseSession });
      return true;
    });
  }

  async dismiss(session: SessionIdentity, correlationId: string, id: string): Promise<void> {
    const { context } = await authorizationService.authorize({ session, correlationId, allowedRoles: ["ADMIN"] });
    await withMongoTransaction(async (databaseSession) => {
      const dismissed = await accessRequestRepository.dismissCompleted(id, context.actorUserId, databaseSession);
      if (!dismissed) throw new AppError({ code: "CONFLICT", message: "Only completed access requests can be dismissed.", status: 409 });
      await auditLogRepository.append({ context, entityType: "ACCESS_REQUEST", entityId: id, action: "ACCESS_REQUEST_DISMISSED", metadata: {}, session: databaseSession });
      return true;
    });
  }
}
export const accessRequestService = new AccessRequestService();
