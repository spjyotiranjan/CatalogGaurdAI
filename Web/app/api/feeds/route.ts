import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { createFeedResponseSchema, feedListResponseSchema } from "@/lib/contracts/feeds";
import { CORRELATION_ID_HEADER } from "@/lib/request/correlation-id";
import { requireSessionIdentity } from "@/server/auth/session-boundary";
import { errorResponse } from "@/server/errors/responses";
import { requestCorrelationContext } from "@/server/request/context";
import { feedService } from "@/server/services/feeds";
export const runtime = "nodejs";
export async function POST(request: Request) { const { correlationId } = requestCorrelationContext(request); try { const data = await feedService.create(request, requireSessionIdentity(await auth()), correlationId); return NextResponse.json(createFeedResponseSchema.parse({ data }), { status: 201, headers: { [CORRELATION_ID_HEADER]: correlationId, "cache-control": "no-store" } }); } catch (error) { return errorResponse(error, correlationId, "feeds.create"); } }
export async function GET(request: Request) { const { correlationId } = requestCorrelationContext(request); try { const cursor = new URL(request.url).searchParams.get("cursor") ?? undefined; const data = await feedService.list(requireSessionIdentity(await auth()), correlationId, cursor); return NextResponse.json(feedListResponseSchema.parse(data), { headers: { [CORRELATION_ID_HEADER]: correlationId, "cache-control": "no-store" } }); } catch (error) { return errorResponse(error, correlationId, "feeds.list"); } }
