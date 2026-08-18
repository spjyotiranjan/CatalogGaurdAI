import { MOCK_SESSIONS } from "@/lib/fixtures/session";
import type { Role, SessionUser } from "@/lib/types/session";

const VALID_ROLES: Role[] = ["SELLER_OPERATOR", "CATALOG_REVIEWER", "ADMIN"];

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && VALID_ROLES.includes(value as Role);
}

export function getMockSession(role: Role): SessionUser {
  return MOCK_SESSIONS[role];
}
