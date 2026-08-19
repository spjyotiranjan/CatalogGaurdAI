import "server-only";

import mongoose from "mongoose";

import { type ValidationJobResult } from "@/lib/contracts/orchestration";
import { AppError } from "@/lib/contracts/errors";
import { getOrchestrationBridgeEnvironment } from "@/server/config/env";
import { auditLogRepository } from "@/server/repositories/audit-log-repository";
import { serviceMessageNonceRepository } from "@/server/repositories/service-message-nonce-repository";
import { feedUploadRepository } from "@/server/repositories/feed-upload-repository";
import { createServiceExecutionContext } from "@/server/request/context";
import type { VerifiedOrchestrationMessage } from "@/server/integrations/orchestration/signing";

export class OrchestrationCallbackService {
  async acceptFixture(input: {
    result: ValidationJobResult;
    message: VerifiedOrchestrationMessage;
  }): Promise<void> {
    const environment = getOrchestrationBridgeEnvironment();
    if (!environment) {
      throw new AppError({ code: "DEPENDENCY_UNAVAILABLE", message: "The Orchestration bridge is not configured.", status: 503, retryable: true });
    }
    if (input.result.execution.actorService !== input.message.serviceId) {
      throw new AppError({ code: "ACTOR_IDENTITY_MISMATCH", message: "The callback actor identity is not allowed.", status: 403 });
    }

    const context = createServiceExecutionContext({
      correlationId: input.result.execution.correlationId,
      actorService: input.message.serviceId,
      sellerId: input.result.sellerId,
    });
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        const claimed = await serviceMessageNonceRepository.claim({
          serviceId: input.message.serviceId,
          keyVersion: input.message.keyVersion,
          nonce: input.message.nonce,
          retentionSeconds: environment.ORCHESTRATION_REPLAY_NONCE_RETENTION_SECONDS,
          session,
        });
        if (!claimed) {
          throw new AppError({ code: "SERVICE_MESSAGE_REPLAYED", message: "The service message has already been processed.", status: 409 });
        }
        const feed = await feedUploadRepository.applyCallback({
          jobId: input.result.jobId,
          sellerId: input.result.sellerId,
          feedUploadId: input.result.feedUploadId,
          checksum: input.result.checksum,
          idempotencyKey: input.result.idempotencyKey,
          outcome: input.result.outcome,
          totalRows: input.result.summary.totalRows,
          processedRows: input.result.summary.processedRows,
          acceptedRows: input.result.summary.acceptedRows,
          rejectedRows: input.result.summary.rejectedRows,
          session,
        });
        if (!feed) {
          throw new AppError({ code: "JOB_CONTRACT_INVALID", message: "The callback does not match a persisted feed job.", status: 409 });
        }
        await auditLogRepository.append({
          context,
          entityType: "FEED",
          entityId: input.result.feedUploadId,
          sellerId: input.result.sellerId,
          action: "ORCHESTRATION_CALLBACK_ACCEPTED",
          metadata: {
            contractVersion: input.result.contractVersion,
            jobId: input.result.jobId,
            idempotencyKey: input.result.idempotencyKey,
            outcome: input.result.outcome,
            processedRows: input.result.summary.processedRows, feedStatus: feed.processingStatus,
          },
          session,
        });
      });
    } finally {
      await session.endSession();
    }
  }
}

export const orchestrationCallbackService = new OrchestrationCallbackService();
