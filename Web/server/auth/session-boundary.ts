import "server-only";

import type { Session } from "next-auth";

import { AppError } from "@/lib/contracts/errors";
import type { SessionIdentity } from "@/server/auth/authorization";

export function requireSessionIdentity(session: Session | null): SessionIdentity {
  if (!session?.user?.id || session.user.status !== "ACTIVE") {
    throw new AppError({
      code: "AUTHENTICATION_REQUIRED",
      message: "Authentication is required.",
      status: 401,
    });
  }

  return { userId: session.user.id };
}
