import "server-only";

import type { UserRole } from "@/lib/contracts/auth";
import { AppError } from "@/lib/contracts/errors";
import { createUserExecutionContext, type UserExecutionContext } from "@/server/request/context";
import {
  userRepository,
  type AuthorizationUser,
  type UserRepository,
} from "@/server/repositories/user-repository";

export type SessionIdentity = {
  userId: string;
};

type AuthorizationInput = {
  session: SessionIdentity | null;
  correlationId: string;
  allowedRoles?: readonly UserRole[];
  requestedSellerId?: string | null;
};

export class AuthorizationService {
  constructor(private readonly users: Pick<UserRepository, "findActiveById"> = userRepository) {}

  async authorize(input: AuthorizationInput): Promise<{
    context: UserExecutionContext;
    user: AuthorizationUser;
  }> {
    if (!input.session?.userId) {
      throw new AppError({
        code: "AUTHENTICATION_REQUIRED",
        message: "Authentication is required.",
        status: 401,
      });
    }

    const user = await this.users.findActiveById(input.session.userId);
    if (!user) {
      throw new AppError({
        code: "SESSION_INACTIVE",
        message: "The session is no longer active.",
        status: 401,
      });
    }

    if (user.role === "SELLER_OPERATOR" && !user.sellerId) {
      throw new AppError({
        code: "AUTHORIZATION_DENIED",
        message: "The account does not have a valid seller scope.",
        status: 403,
      });
    }

    if (user.role !== "SELLER_OPERATOR" && user.sellerId) {
      throw new AppError({
        code: "AUTHORIZATION_DENIED",
        message: "The account has an invalid authorization scope.",
        status: 403,
      });
    }

    if (input.allowedRoles && !input.allowedRoles.includes(user.role)) {
      throw new AppError({
        code: "AUTHORIZATION_DENIED",
        message: "You are not authorized to perform this operation.",
        status: 403,
      });
    }

    if (
      input.requestedSellerId &&
      user.role === "SELLER_OPERATOR" &&
      input.requestedSellerId !== user.sellerId
    ) {
      throw new AppError({
        code: "TENANT_SCOPE_DENIED",
        message: "The requested resource is outside your seller scope.",
        status: 403,
      });
    }

    return {
      user,
      context: createUserExecutionContext({
        correlationId: input.correlationId,
        userId: user.id,
        role: user.role,
        sellerId: user.sellerId,
      }),
    };
  }
}

export const authorizationService = new AuthorizationService();
