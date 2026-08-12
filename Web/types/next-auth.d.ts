import type { DefaultSession } from "next-auth";

import type { UserRole, UserStatus } from "@/lib/contracts/auth";

declare module "next-auth" {
  interface User {
    id: string;
    sellerId: string | null;
    role: UserRole;
    status: UserStatus;
  }

  interface Session {
    user: DefaultSession["user"] & {
      id: string;
      sellerId: string | null;
      role: UserRole;
      status: UserStatus;
    };
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    userId?: string;
    sellerId?: string | null;
    role?: UserRole;
    status?: UserStatus;
  }
}
