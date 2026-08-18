import { NextResponse } from "next/server";
import { accessRequestSubmissionSchema, createAccessRequestSchema } from "@/lib/contracts/access-requests";
import { CORRELATION_ID_HEADER } from "@/lib/request/correlation-id";
import { errorResponse } from "@/server/errors/responses";
import { requestCorrelationContext } from "@/server/request/context";
import { accessRequestService } from "@/server/services/access-requests";
export const runtime = "nodejs";
export async function POST(request: Request) { const { correlationId } = requestCorrelationContext(request); try { const id = await accessRequestService.submit(createAccessRequestSchema.parse(await request.json()), correlationId); return NextResponse.json(accessRequestSubmissionSchema.parse({ data: { id } }), { status: 201, headers: { [CORRELATION_ID_HEADER]: correlationId, "cache-control": "no-store" } }); } catch (error) { return errorResponse(error, correlationId, "access-request.submit"); } }
