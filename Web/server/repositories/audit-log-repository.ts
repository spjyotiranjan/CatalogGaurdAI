import "server-only";

import { Types, type ClientSession } from "mongoose";

import type { ExecutionContext } from "@/server/request/context";
import { connectToDatabase } from "@/server/db/mongoose";
import { AuditLogModel, auditEntityTypes } from "@/server/models/audit-log";

type AuditEntityType = (typeof auditEntityTypes)[number];

export type AppendAuditEventInput = {
  context: ExecutionContext;
  entityType: AuditEntityType;
  entityId: string | null;
  action: string;
  sellerId?: string | null;
  beforeSnapshot?: Record<string, unknown>;
  afterSnapshot?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  session?: ClientSession;
};

const sensitiveKeyPattern = /password|secret|token|prompt|storage|rawpayload|authorization|cookie/i;

function sanitizeSnapshot(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sanitizeSnapshot);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([key]) => !sensitiveKeyPattern.test(key))
        .map(([key, nested]) => [key, sanitizeSnapshot(nested)]),
    );
  }

  return value;
}

export class AuditLogRepository {
  async append(input: AppendAuditEventInput): Promise<string> {
    await connectToDatabase();
    const [created] = await AuditLogModel.create(
      [
        {
          sellerId: input.sellerId ? new Types.ObjectId(input.sellerId) : null,
          actorType: input.context.actorType,
          actorUserId:
            input.context.actorType === "USER"
              ? new Types.ObjectId(input.context.actorUserId)
              : null,
          actorService:
            input.context.actorType === "USER" ? null : input.context.actorService,
          entityType: input.entityType,
          entityId: input.entityId ? new Types.ObjectId(input.entityId) : null,
          action: input.action,
          beforeSnapshot: sanitizeSnapshot(input.beforeSnapshot),
          afterSnapshot: sanitizeSnapshot(input.afterSnapshot),
          metadata: sanitizeSnapshot(input.metadata),
          correlationId: input.context.correlationId,
          occurredAt: new Date(),
        },
      ],
      { session: input.session },
    );
    return created._id.toString();
  }
}

export const auditLogRepository = new AuditLogRepository();
