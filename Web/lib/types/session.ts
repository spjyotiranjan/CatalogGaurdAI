import type { UserRole } from "@/lib/contracts/auth";

/**
 * Presentation types derived from the authenticated Web backend account.
 *
 * Protected pages re-authorize the active database user before rendering.
 *
 * Navigation is presentation-only and never an authorization
 * decision — it exists only to let UI components render a plausible,
 * server-shaped state before Web Backend Phase 1 exists.
 */

/** UI role is the same contract type that Auth.js and BFF authorization use. */
export type Role = UserRole;

export interface SessionUser {
  userId: string;
  name: string;
  email: string;
  role: Role;
  /** Present only for SELLER_OPERATOR; null for reviewer/admin (global scope). */
  sellerId: string | null;
  sellerName: string | null;
}

export interface AuthState {
  status: "loading" | "authenticated" | "unauthenticated" | "expired";
  user: SessionUser | null;
  correlationId: string;
}

export type NavIconName =
  | "dashboard"
  | "upload"
  | "history"
  | "catalog"
  | "profile"
  | "queue"
  | "issues"
  | "feeds"
  | "products"
  | "sellers"
  | "users"
  | "categories"
  | "rules"
  | "audit"
  | "requests";

export interface NavItem {
  label: string;
  href: string;
  icon: NavIconName;
}

export const NAV_BY_ROLE: Record<Role, NavItem[]> = {
  SELLER_OPERATOR: [
    { label: "Dashboard", href: "/seller/dashboard", icon: "dashboard" },
    { label: "Upload feed", href: "/seller/feeds/upload", icon: "upload" },
    { label: "Feed history", href: "/seller/feeds", icon: "history" },
    { label: "Product catalog", href: "/seller/products", icon: "catalog" },
    { label: "Profile", href: "/profile/security", icon: "profile" },
  ],
  CATALOG_REVIEWER: [
    { label: "Dashboard", href: "/reviewer/dashboard", icon: "dashboard" },
    { label: "Review queue", href: "/reviewer/queue", icon: "queue" },
    { label: "Validation issues", href: "/reviewer/issues", icon: "issues" },
    { label: "Product catalog", href: "/reviewer/products", icon: "catalog" },
    { label: "Feed history", href: "/reviewer/feeds", icon: "feeds" },
    { label: "Profile", href: "/profile/security", icon: "profile" },
  ],
  ADMIN: [
    { label: "Dashboard", href: "/admin/dashboard", icon: "dashboard" },
    { label: "Feeds", href: "/admin/feeds", icon: "feeds" },
    { label: "Products", href: "/admin/products", icon: "products" },
    { label: "Sellers", href: "/admin/sellers", icon: "sellers" },
    { label: "Users", href: "/admin/users", icon: "users" },
    { label: "Categories", href: "/admin/categories", icon: "categories" },
    { label: "Validation rules", href: "/admin/rules", icon: "rules" },
    { label: "Access requests", href: "/admin/access-requests", icon: "requests" },
    { label: "Audit log", href: "/admin/audit", icon: "audit" },
    { label: "Profile", href: "/profile/security", icon: "profile" },
  ],
};

export const ROLE_LABEL: Record<Role, string> = {
  SELLER_OPERATOR: "Seller",
  CATALOG_REVIEWER: "Reviewer",
  ADMIN: "Admin",
};

export const ROLE_RAIL_GROUP: Record<Role, string> = {
  SELLER_OPERATOR: "Seller Operator",
  CATALOG_REVIEWER: "Catalog Reviewer",
  ADMIN: "Platform Admin",
};

export const ROLE_HOME: Record<Role, string> = {
  SELLER_OPERATOR: "/seller/dashboard",
  CATALOG_REVIEWER: "/reviewer/dashboard",
  ADMIN: "/admin/dashboard",
};
