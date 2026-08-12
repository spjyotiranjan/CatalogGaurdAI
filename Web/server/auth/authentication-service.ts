import "server-only";

import { createHash } from "node:crypto";

import { normalizeEmail, type LoginCredentials } from "@/lib/contracts/auth";
import { getEnvironment } from "@/server/config/env";
import { SlidingWindowRateLimiter } from "@/server/rate-limit/sliding-window";
import {
  userRepository,
  type AuthenticationUser,
  type UserRepository,
} from "@/server/repositories/user-repository";
import { verifyPassword } from "@/server/auth/passwords";
import { auditSignIn } from "@/server/auth/audit";
import { withMongoTransaction } from "@/server/db/transaction";

const dummyPasswordHash =
  "$2b$12$C6UzMDM.H6dfI/f/IKcEe.8Gx0Z4RkwM7f9mH/2qVf3.3V0aNJ8ZK";

const environment = getEnvironment();
export const loginRateLimiter = new SlidingWindowRateLimiter(
  environment.LOGIN_RATE_LIMIT_WINDOW_MS,
  environment.LOGIN_RATE_LIMIT_MAX_ATTEMPTS,
);

export function emailFingerprint(email: string): string {
  return createHash("sha256").update(normalizeEmail(email)).digest("hex");
}

export class AuthenticationService {
  constructor(
    private readonly users: Pick<
      UserRepository,
      "findForAuthenticationByEmail" | "recordSuccessfulLogin"
    > = userRepository,
    private readonly rateLimiter: Pick<SlidingWindowRateLimiter, "consume"> = loginRateLimiter,
  ) {}

  async authenticate(
    credentials: LoginCredentials,
    rateLimitKey: string,
    correlationId: string,
  ): Promise<
    | { user: AuthenticationUser; failureReason: null }
    | { user: null; failureReason: "INVALID_CREDENTIALS" | "INACTIVE_USER" | "RATE_LIMITED" }
  > {
    const rateLimit = this.rateLimiter.consume(rateLimitKey);
    if (!rateLimit.allowed) {
      return { user: null, failureReason: "RATE_LIMITED" };
    }

    const user = await this.users.findForAuthenticationByEmail(credentials.email);
    const matches = await verifyPassword(
      credentials.password,
      user?.passwordHash ?? dummyPasswordHash,
    );

    if (!user || !matches) {
      return { user: null, failureReason: "INVALID_CREDENTIALS" };
    }

    if (user.status !== "ACTIVE") {
      return { user: null, failureReason: "INACTIVE_USER" };
    }

    if (user.role === "SELLER_OPERATOR" && !user.sellerId) {
      return { user: null, failureReason: "INACTIVE_USER" };
    }

    if (user.role !== "SELLER_OPERATOR" && user.sellerId) {
      return { user: null, failureReason: "INACTIVE_USER" };
    }

    await withMongoTransaction(async (session) => {
      await this.users.recordSuccessfulLogin(user.id, session);
      await auditSignIn({
        correlationId,
        userId: user.id,
        sellerId: user.sellerId,
        role: user.role,
        session,
      });
      return true;
    });
    return { user, failureReason: null };
  }
}

export const authenticationService = new AuthenticationService();
