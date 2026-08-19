import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";

import { parseAuthJsCredentials } from "@/lib/contracts/auth";
import { resolveCorrelationId } from "@/lib/request/correlation-id";
import {
  auditAuthenticationFailure,
  auditSignOut,
} from "@/server/auth/audit";
import {
  authenticationService,
  emailFingerprint,
} from "@/server/auth/authentication-service";
import { getEnvironment } from "@/server/config/env";
import { logger } from "@/server/observability/logger";
import { userRepository } from "@/server/repositories/user-repository";

const environment = getEnvironment();

function requestAddress(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown"
  );
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: environment.AUTH_SECRET,
  trustHost: environment.AUTH_TRUST_HOST,
  session: {
    strategy: "jwt",
    maxAge: environment.SESSION_MAX_AGE_SECONDS,
    updateAge: environment.SESSION_UPDATE_AGE_SECONDS,
  },
  cookies: {
    sessionToken: {
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: environment.CATALOGGUARD_ENVIRONMENT !== "development" &&
          environment.CATALOGGUARD_ENVIRONMENT !== "test",
      },
    },
  },
  providers: [
    Credentials({
      credentials: {
        email: { type: "email" },
        password: { type: "password" },
      },
      async authorize(rawCredentials, request) {
        const correlationId = resolveCorrelationId(request.headers);
        const parsed = parseAuthJsCredentials(rawCredentials);
        if (!parsed.success) {
          const suppliedEmail =
            typeof rawCredentials?.email === "string"
              ? rawCredentials.email
              : "unavailable";
          await auditAuthenticationFailure({
            correlationId,
            emailFingerprint: emailFingerprint(suppliedEmail),
            reason: "INVALID_CREDENTIALS",
          });
          return null;
        }

        const fingerprint = emailFingerprint(parsed.data.email);
        const result = await authenticationService.authenticate(
          parsed.data,
          `${requestAddress(request)}:${fingerprint}`,
          correlationId,
        );

        if (!result.user) {
          await auditAuthenticationFailure({
            correlationId,
            emailFingerprint: fingerprint,
            reason: result.failureReason,
          });
          return null;
        }

        return {
          id: result.user.id,
          name: result.user.fullName,
          email: result.user.email,
          sellerId: result.user.sellerId,
          role: result.user.role,
          status: result.user.status,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.userId = user.id;
        token.sellerId = user.sellerId;
        token.role = user.role;
        token.status = user.status;
        return token;
      }

      if (!token.userId) {
        return null;
      }

      const activeUser = await userRepository.findActiveById(token.userId);
      if (!activeUser) {
        return null;
      }

      token.sellerId = activeUser.sellerId;
      token.role = activeUser.role;
      token.status = activeUser.status;
      return token;
    },
    async session({ session, token }) {
      if (!token.userId || !token.role || token.status !== "ACTIVE") {
        return session;
      }

      session.user.id = token.userId;
      session.user.sellerId = token.sellerId ?? null;
      session.user.role = token.role;
      session.user.status = token.status;
      return session;
    },
  },
  events: {
    async signOut(message) {
      if (!("token" in message) || !message.token?.userId || !message.token.role) {
        return;
      }
      await auditSignOut({
        userId: message.token.userId,
        sellerId: message.token.sellerId ?? null,
        role: message.token.role,
      });
    },
  },
  logger: {
    error(error) {
      logger.error("Authentication framework error", {
        operation: "auth.framework",
        outcomeCode: error.name,
      });
    },
    warn(code) {
      logger.warn("Authentication framework warning", {
        operation: "auth.framework",
        outcomeCode: code,
      });
    },
  },
});
