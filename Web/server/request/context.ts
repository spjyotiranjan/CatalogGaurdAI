import "server-only";

import { z } from "zod";

import type { UserRole } from "@/lib/contracts/auth";
import { resolveCorrelationId } from "@/lib/request/correlation-id";

const objectIdStringSchema = z.string().regex(/^[a-f\d]{24}$/i);

type BaseContext = {
  correlationId: string;
};

export type UserExecutionContext = BaseContext & {
  actorType: "USER";
  actorUserId: string;
  actorService: null;
  role: UserRole;
  sellerId: string | null;
};

export type ServiceExecutionContext = BaseContext & {
  actorType: "SYSTEM" | "AI";
  actorUserId: null;
  actorService: string;
  role: null;
  sellerId: string | null;
};

export type ExecutionContext = UserExecutionContext | ServiceExecutionContext;

export function requestCorrelationContext(request: Request): BaseContext {
  return { correlationId: resolveCorrelationId(request.headers) };
}

export function createUserExecutionContext(input: {
  correlationId: string;
  userId: string;
  role: UserRole;
  sellerId: string | null;
}): UserExecutionContext {
  return {
    correlationId: z.uuid().parse(input.correlationId),
    actorType: "USER",
    actorUserId: objectIdStringSchema.parse(input.userId),
    actorService: null,
    role: input.role,
    sellerId: input.sellerId === null ? null : objectIdStringSchema.parse(input.sellerId),
  };
}

