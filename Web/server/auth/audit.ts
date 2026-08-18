import "server-only";

import { randomUUID } from "node:crypto";
import type { ClientSession } from "mongoose";

import type { UserRole } from "@/lib/contracts/auth";
import { auditLogRepository } from "@/server/repositories/audit-log-repository";
import type { ServiceExecutionContext, UserExecutionContext } from "@/server/request/context";

function authSystemContext(correlationId: string = randomUUID()): ServiceExecutionContext {
  return {
    correlationId,
    actorType: "SYSTEM",
    actorUserId: null,
    actorService: "web-auth",
    role: null,
    sellerId: null,
  };
}

export async function auditAuthenticationFailure(input: {
  correlationId?: string;
  emailFingerprint: string;
  reason: "INVALID_CREDENTIALS" | "INACTIVE_USER" | "RATE_LIMITED";
}): Promise<void> {
  await auditLogRepository.append({
    context: authSystemContext(input.correlationId),
    entityType: "AUTH",
    entityId: null,
    action: "AUTHENTICATION_FAILED",
    metadata: {
      emailFingerprint: input.emailFingerprint,
      reason: input.reason,
    },
  });
}

export async function auditSignIn(input: {
  correlationId?: string;
  userId: string;
  sellerId: string | null;
  role: UserRole;
  session?: ClientSession;
}): Promise<void> {
  const context: UserExecutionContext = {
    correlationId: input.correlationId ?? randomUUID(),
    actorType: "USER",
    actorUserId: input.userId,
    actorService: null,
    role: input.role,
    sellerId: input.sellerId,
  };
  await auditLogRepository.append({
    context,
    entityType: "AUTH",
    entityId: input.userId,
    sellerId: input.sellerId,
    action: "LOGIN_SUCCEEDED",
    session: input.session,
  });
}

export async function auditSignOut(input: {
  userId: string;
  sellerId: string | null;
  role: UserRole;
  correlationId?: string;
}): Promise<void> {
  const context: UserExecutionContext = {
    correlationId: input.correlationId ?? randomUUID(),
    actorType: "USER",
    actorUserId: input.userId,
    actorService: null,
    role: input.role,
    sellerId: input.sellerId,
  };
  await auditLogRepository.append({
    context,
    entityType: "AUTH",
    entityId: input.userId,
    sellerId: input.sellerId,
    action: "LOGOUT_SUCCEEDED",
  });
}

export async function auditPasswordChange(input: {
  correlationId: string;
  userId: string;
  sellerId: string | null;
  role: UserRole;
  session?: ClientSession;
}): Promise<void> {
  const context: UserExecutionContext = {
    correlationId: input.correlationId,
    actorType: "USER",
    actorUserId: input.userId,
    actorService: null,
    role: input.role,
    sellerId: input.sellerId,
  };
  await auditLogRepository.append({
    context,
    entityType: "USER",
    entityId: input.userId,
    sellerId: input.sellerId,
    action: "PASSWORD_CHANGED",
    session: input.session,
  });
}
