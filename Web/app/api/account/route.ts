import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { CORRELATION_ID_HEADER } from "@/lib/request/correlation-id";
import { accountService } from "@/server/account/account-service";
import { requireSessionIdentity } from "@/server/auth/session-boundary";
import { errorResponse } from "@/server/errors/responses";
import { requestCorrelationContext } from "@/server/request/context";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { correlationId } = requestCorrelationContext(request);

  try {
    const sessionIdentity = requireSessionIdentity(await auth());
    const account = await accountService.getCurrentAccount(
      sessionIdentity,
      correlationId,
    );
    return NextResponse.json(account, {
      headers: {
        [CORRELATION_ID_HEADER]: correlationId,
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    return errorResponse(error, correlationId, "account.read");
  }
}
