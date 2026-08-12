import { NextResponse, type NextRequest } from "next/server";

import {
  CORRELATION_ID_HEADER,
  resolveCorrelationId,
} from "@/lib/request/correlation-id";

export function proxy(request: NextRequest) {
  const correlationId = resolveCorrelationId(request.headers);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(CORRELATION_ID_HEADER, correlationId);

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });
  response.headers.set(CORRELATION_ID_HEADER, correlationId);
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
