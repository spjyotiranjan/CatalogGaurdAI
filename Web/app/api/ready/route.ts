import { NextResponse } from "next/server";

import { AppError } from "@/lib/contracts/errors";
import { CORRELATION_ID_HEADER } from "@/lib/request/correlation-id";
import { getEnvironment } from "@/server/config/env";
import { checkDatabaseReadiness } from "@/server/db/mongoose";
import { errorResponse } from "@/server/errors/responses";
import { requestCorrelationContext } from "@/server/request/context";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { correlationId } = requestCorrelationContext(request);

  try {
    const databaseReadiness = await checkDatabaseReadiness();
    if (!databaseReadiness.ready) {
      throw new AppError({
        code: "DEPENDENCY_UNAVAILABLE",
        message: "The MongoDB dependency is unavailable.",
        status: 503,
        retryable: true,
        details: {
          dependency: "mongodb",
          ...databaseReadiness.diagnostic,
        },
      });
    }

    const environment = getEnvironment();
    return NextResponse.json(
      {
        status: "ready",
        service: environment.CATALOGGUARD_SERVICE_NAME,
        version: environment.CATALOGGUARD_APP_VERSION,
        dependencies: { mongodb: "ready" },
      },
      {
        headers: {
          [CORRELATION_ID_HEADER]: correlationId,
          "cache-control": "no-store",
        },
      },
    );
  } catch (error) {
    return errorResponse(error, correlationId, "readiness.check");
  }
}
