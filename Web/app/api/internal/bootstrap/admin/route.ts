import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { bootstrapAdminSchema } from "@/lib/contracts/access-requests";
import { CORRELATION_ID_HEADER } from "@/lib/request/correlation-id";
import { AppError } from "@/lib/contracts/errors";
import { hashPassword } from "@/server/auth/passwords";
import { getEnvironment } from "@/server/config/env";
import { errorResponse } from "@/server/errors/responses";
import { requestCorrelationContext } from "@/server/request/context";
import { userRepository } from "@/server/repositories/user-repository";

export const runtime = "nodejs";
export async function POST(request: Request) { const { correlationId } = requestCorrelationContext(request); try { const secret = getEnvironment().BOOTSTRAP_ADMIN_SECRET; const supplied = request.headers.get("x-catalogguard-bootstrap-secret"); if (!secret || !supplied || supplied.length !== secret.length || !timingSafeEqual(Buffer.from(supplied), Buffer.from(secret))) throw new AppError({ code: "AUTHORIZATION_DENIED", message: "Bootstrap authorization failed.", status: 403 }); const input = bootstrapAdminSchema.parse(await request.json()); const user = await userRepository.create({ sellerId: null, fullName: input.fullName, email: input.email, passwordHash: await hashPassword(input.password), role: "ADMIN", status: "ACTIVE" }); return NextResponse.json({ data: user }, { status: 201, headers: { [CORRELATION_ID_HEADER]: correlationId, "cache-control": "no-store" } }); } catch (error) { return errorResponse(error, correlationId, "admin.bootstrap"); } }
