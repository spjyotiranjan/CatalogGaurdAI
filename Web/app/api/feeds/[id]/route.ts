import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { feedDetailResponseSchema } from "@/lib/contracts/feeds";
import { CORRELATION_ID_HEADER } from "@/lib/request/correlation-id";
import { requireSessionIdentity } from "@/server/auth/session-boundary";
import { errorResponse } from "@/server/errors/responses";
import { requestCorrelationContext } from "@/server/request/context";
import { feedService } from "@/server/services/feeds";
export const runtime = "nodejs";
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) { const { correlationId } = requestCorrelationContext(request); try { const { id } = await params; const data = await feedService.detail(requireSessionIdentity(await auth()), correlationId, id); return NextResponse.json(feedDetailResponseSchema.parse({ data }), { headers: { [CORRELATION_ID_HEADER]: correlationId, "cache-control": "no-store" } }); } catch (error) { return errorResponse(error, correlationId, "feeds.detail"); } }
