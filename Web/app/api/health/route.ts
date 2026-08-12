import { NextResponse } from "next/server";

import { CORRELATION_ID_HEADER } from "@/lib/request/correlation-id";
import { getEnvironment } from "@/server/config/env";
import { requestCorrelationContext } from "@/server/request/context";

export const runtime = "nodejs";

export function GET(request: Request) {
  const { correlationId } = requestCorrelationContext(request);
  const environment = getEnvironment();
  return NextResponse.json(
    {
      status: "ok",
      service: environment.CATALOGGUARD_SERVICE_NAME,
      version: environment.CATALOGGUARD_APP_VERSION,
    },
    {
      headers: {
        [CORRELATION_ID_HEADER]: correlationId,
        "cache-control": "no-store",
      },
    },
  );
}
