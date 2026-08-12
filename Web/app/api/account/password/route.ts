import { auth } from "@/auth";
import { passwordChangeSchema } from "@/lib/contracts/auth";
import { CORRELATION_ID_HEADER } from "@/lib/request/correlation-id";
import { passwordService } from "@/server/account/password-service";
import { assertSameOrigin } from "@/server/auth/csrf";
import { requireSessionIdentity } from "@/server/auth/session-boundary";
import { errorResponse } from "@/server/errors/responses";
import { requestCorrelationContext } from "@/server/request/context";

export const runtime = "nodejs";

export async function PATCH(request: Request) {
  const { correlationId } = requestCorrelationContext(request);

  try {
    assertSameOrigin(request);
    const sessionIdentity = requireSessionIdentity(await auth());
    const passwordChange = passwordChangeSchema.parse(await request.json());
    await passwordService.changePassword({
      session: sessionIdentity,
      correlationId,
      passwordChange,
    });
    return new Response(null, {
      status: 204,
      headers: {
        [CORRELATION_ID_HEADER]: correlationId,
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    return errorResponse(error, correlationId, "account.password.change");
  }
}
