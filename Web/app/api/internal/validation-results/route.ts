import { NextResponse } from "next/server";

import { validationJobResultSchema, orchestrationCallbackPath } from "@/lib/contracts/orchestration";
import { AppError } from "@/lib/contracts/errors";
import { CORRELATION_ID_HEADER } from "@/lib/request/correlation-id";
import { getOrchestrationBridgeEnvironment } from "@/server/config/env";
import { errorResponse } from "@/server/errors/responses";
import { verifyOrchestrationMessage } from "@/server/integrations/orchestration/signing";
import { requestCorrelationContext } from "@/server/request/context";
import { orchestrationCallbackService } from "@/server/services/orchestration-callback";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const { correlationId } = requestCorrelationContext(request);
  try {
    if (new URL(request.url).pathname !== orchestrationCallbackPath) {
      throw new AppError({ code: "JOB_CONTRACT_INVALID", message: "The callback path is not supported.", status: 404 });
    }
    if (request.headers.get("content-type")?.split(";", 1)[0]?.trim() !== "application/json") {
      throw new AppError({ code: "JOB_CONTRACT_INVALID", message: "The callback must use application/json.", status: 415 });
    }
    const body = new Uint8Array(await request.arrayBuffer());
    const environment = getOrchestrationBridgeEnvironment();
    if (!environment) {
      throw new AppError({ code: "DEPENDENCY_UNAVAILABLE", message: "The Orchestration bridge is not configured.", status: 503, retryable: true });
    }
    const message = verifyOrchestrationMessage({
      headers: request.headers,
      body,
      method: request.method,
      path: orchestrationCallbackPath,
      expectedKeyVersion: environment.ORCHESTRATION_CALLBACK_KEY_VERSION,
      expectedServiceId: environment.ORCHESTRATION_CALLBACK_SERVICE_ID,
      signingSecret: environment.ORCHESTRATION_CALLBACK_SIGNING_SECRET,
      maxClockSkewSeconds: environment.ORCHESTRATION_SERVICE_AUTH_MAX_CLOCK_SKEW_SECONDS,
    });
    let payload: unknown;
    try {
      payload = JSON.parse(new TextDecoder().decode(body));
    } catch (error) {
      throw new AppError({ code: "JOB_CONTRACT_INVALID", message: "The callback body was not valid JSON.", status: 400, cause: error });
    }
    const parsed = validationJobResultSchema.safeParse(payload);
    if (!parsed.success) {
      throw new AppError({ code: "JOB_CONTRACT_INVALID", message: "The callback does not match contract v1.", status: 400, cause: parsed.error });
    }
    const result = parsed.data;
    if (result.execution.correlationId !== correlationId) {
      throw new AppError({ code: "CORRELATION_ID_MISMATCH", message: "The callback correlation ID does not match the request.", status: 409 });
    }
    await orchestrationCallbackService.acceptFixture({ result, message });
    return new NextResponse(null, { status: 204, headers: { [CORRELATION_ID_HEADER]: correlationId, "cache-control": "no-store" } });
  } catch (error) {
    return errorResponse(error, correlationId, "orchestration.callback.contract");
  }
}
