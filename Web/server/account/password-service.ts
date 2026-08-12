import "server-only";

import type { z } from "zod";

import type { passwordChangeSchema } from "@/lib/contracts/auth";
import { AppError } from "@/lib/contracts/errors";
import { auditPasswordChange } from "@/server/auth/audit";
import {
  authorizationService,
  type SessionIdentity,
} from "@/server/auth/authorization";
import { hashPassword, verifyPassword } from "@/server/auth/passwords";
import { withMongoTransaction } from "@/server/db/transaction";
import { userRepository } from "@/server/repositories/user-repository";

type PasswordChange = z.infer<typeof passwordChangeSchema>;

export class PasswordService {
  async changePassword(input: {
    session: SessionIdentity;
    correlationId: string;
    passwordChange: PasswordChange;
  }): Promise<void> {
    const { user } = await authorizationService.authorize({
      session: input.session,
      correlationId: input.correlationId,
    });
    const authenticationUser = await userRepository.findForAuthenticationById(user.id);

    if (
      !authenticationUser ||
      !(await verifyPassword(
        input.passwordChange.currentPassword,
        authenticationUser.passwordHash,
      ))
    ) {
      throw new AppError({
        code: "INVALID_CREDENTIALS",
        message: "The current password is incorrect.",
        status: 400,
      });
    }

    if (input.passwordChange.currentPassword === input.passwordChange.newPassword) {
      throw new AppError({
        code: "VALIDATION_FAILED",
        message: "The new password must differ from the current password.",
        status: 400,
      });
    }

    const passwordHash = await hashPassword(input.passwordChange.newPassword);
    await withMongoTransaction(async (databaseSession) => {
      const updated = await userRepository.replacePasswordHash(
        user.id,
        passwordHash,
        databaseSession,
      );
      if (!updated) {
        throw new AppError({
          code: "CONFLICT",
          message: "The password could not be updated.",
          status: 409,
          retryable: true,
        });
      }

      await auditPasswordChange({
        correlationId: input.correlationId,
        userId: user.id,
        sellerId: user.sellerId,
        role: user.role,
        session: databaseSession,
      });
      return true;
    });
  }
}

export const passwordService = new PasswordService();
