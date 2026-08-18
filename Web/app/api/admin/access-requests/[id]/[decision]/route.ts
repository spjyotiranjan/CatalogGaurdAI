import { auth } from "@/auth";
import { decideAccessRequestSchema } from "@/lib/contracts/access-requests";
import { CORRELATION_ID_HEADER } from "@/lib/request/correlation-id";
import { assertSameOrigin } from "@/server/auth/csrf";
import { requireSessionIdentity } from "@/server/auth/session-boundary";
import { errorResponse } from "@/server/errors/responses";
import { requestCorrelationContext } from "@/server/request/context";
import { accessRequestService } from "@/server/services/access-requests";
export const runtime = "nodejs";
export async function POST(request: Request, { params }: { params: Promise<{ id: string; decision: string }> }) { const { correlationId } = requestCorrelationContext(request); try { assertSameOrigin(request); const { id, decision } = await params; const session = requireSessionIdentity(await auth()); if (decision === "dismiss") { await accessRequestService.dismiss(session, correlationId, id); return new Response(null, { status: 204, headers: { [CORRELATION_ID_HEADER]: correlationId } }); } if (decision !== "approve" && decision !== "revoke") throw new Error("Unsupported decision"); const input = decideAccessRequestSchema.parse(await request.json()); await accessRequestService.decide(session, correlationId, id, decision === "approve" ? "APPROVED" : "REVOKED", input.reason); return new Response(null, { status: 204, headers: { [CORRELATION_ID_HEADER]: correlationId } }); } catch (error) { return errorResponse(error, correlationId, "access-request.decide"); } }
