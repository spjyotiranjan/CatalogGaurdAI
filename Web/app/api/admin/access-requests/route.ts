import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { accessRequestListSchema } from "@/lib/contracts/access-requests";
import { CORRELATION_ID_HEADER } from "@/lib/request/correlation-id";
import { requireSessionIdentity } from "@/server/auth/session-boundary";
import { errorResponse } from "@/server/errors/responses";
import { requestCorrelationContext } from "@/server/request/context";
import { accessRequestService } from "@/server/services/access-requests";
export const runtime = "nodejs";
export async function GET(request: Request) { const { correlationId } = requestCorrelationContext(request); try { const data = await accessRequestService.list(requireSessionIdentity(await auth()), correlationId); return NextResponse.json(accessRequestListSchema.parse({ data }), { headers: { [CORRELATION_ID_HEADER]: correlationId, "cache-control": "no-store" } }); } catch (error) { return errorResponse(error, correlationId, "access-request.list"); } }
