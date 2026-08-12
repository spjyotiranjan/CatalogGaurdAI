import "server-only";

import type { AccountResponse } from "@/lib/contracts/account";
import type { UserRole } from "@/lib/contracts/auth";
import {
  authorizationService,
  type SessionIdentity,
} from "@/server/auth/authorization";

const allApplicationRoles = [
  "ADMIN",
  "CATALOG_REVIEWER",
  "SELLER_OPERATOR",
] as const satisfies readonly UserRole[];

export class AccountService {
  async getCurrentAccount(
    session: SessionIdentity,
    correlationId: string,
  ): Promise<AccountResponse> {
    const { user } = await authorizationService.authorize({
      session,
      correlationId,
      allowedRoles: allApplicationRoles,
    });

    return { data: user };
  }
}

export const accountService = new AccountService();
