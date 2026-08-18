import "server-only";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import type { UserRole } from "@/lib/contracts/auth";
import { AppError } from "@/lib/contracts/errors";
import type { SessionUser } from "@/lib/types/session";
import { authorizationService } from "@/server/auth/authorization";
import { requireSessionIdentity } from "@/server/auth/session-boundary";

/** Resolves and re-authorizes the active database user before rendering a protected page. */
export async function requirePageSession(
  allowedRoles?: readonly UserRole[],
  loginRedirect = "/login?reason=session",
): Promise<SessionUser> {
  const session = await auth();

  try {
    const { user } = await authorizationService.authorize({
      session: requireSessionIdentity(session),
      correlationId: randomUUID(),
      allowedRoles,
    });

    return {
      userId: user.id,
      name: user.fullName,
      email: user.email,
      role: user.role,
      sellerId: user.sellerId,
      sellerName: user.sellerId ? "Seller workspace" : null,
    };
  } catch (error) {
    if (error instanceof AppError && error.status === 403) {
      redirect("/403");
    }
    if (
      error instanceof AppError &&
      (error.code === "AUTHENTICATION_REQUIRED" || error.code === "SESSION_INACTIVE")
    ) {
      redirect(loginRedirect);
    }
    throw error;
  }
}
