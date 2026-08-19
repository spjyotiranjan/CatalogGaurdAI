import type { Role, SessionUser } from "@/lib/types/session";

/**
 * Fixture sessions used only so Phase 1 screens have something server-shaped
 * to render. Real authentication, role derivation and tenant scope are
 * Web Backend Phase 1 and are NOT implemented here — see AGENTS.md:
 * "Server-side code derives role and seller scope from verified identity."
 */
export const MOCK_SESSIONS: Record<Role, SessionUser> = {
  SELLER_OPERATOR: {
    userId: "usr_2n9a4k",
    name: "Anika Rao",
    email: "anika@northstar.com",
    role: "SELLER_OPERATOR",
    sellerId: "SELL-000182",
    sellerName: "Northstar Retail",
  },
  CATALOG_REVIEWER: {
    userId: "usr_7b13cr",
    name: "Mohammed Yaseen",
    email: "yaseen@marketplace.com",
    role: "CATALOG_REVIEWER",
    sellerId: null,
    sellerName: null,
  },
  ADMIN: {
    userId: "usr_19d8ad",
    name: "S P Jyotiranjan Sahoo",
    email: "sp@marketplace.com",
    role: "ADMIN",
    sellerId: null,
    sellerName: null,
  },
};

export function makeCorrelationId(): string {
  const rand = Math.random().toString(16).slice(2, 6);
  const ts = Date.now().toString(16).slice(-8);
  return `cg-${rand}-${ts}`;
}
