import type { NavIconName } from "@/lib/types/session";

const PATHS: Record<NavIconName, string> = {
  dashboard: "M3 3h7v7H3V3Zm11 0h7v11h-7V3ZM3 13h7v8H3v-8Zm11 5h7v3h-7v-3Z",
  upload: "M12 3v12m0-12 4.5 4.5M12 3 7.5 7.5M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2",
  history: "M3 12a9 9 0 1 0 3-6.7M3 4v5h5M12 7v5l3 3",
  catalog: "M4 5h16M4 12h16M4 19h10",
  profile: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8a7 7 0 0 1 14 0",
  queue: "M4 6h16M4 12h10M4 18h16",
  issues: "M12 3 2 20h20L12 3Zm0 6v5m0 3h.01",
  feeds: "M4 4v6a10 10 0 0 0 10 10M4 4h6M4 4v0M8 16a4 4 0 0 1 4 4",
  products: "M21 8 12 3 3 8l9 5 9-5Zm0 0v8l-9 5m0-8v8m0-8L3 8m0 0v8l9 5",
  sellers: "M3 21V9l9-6 9 6v12h-6v-7H9v7H3Z",
  users: "M16 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM8 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm8 2c3.3 0 6 1.8 6 4v2h-6v-2c0-1-.4-1.9-1-2.6.3-.9.5-1 1-1.4ZM8 13c3.3 0 6 1.8 6 4v2H2v-2c0-2.2 2.7-4 6-4Z",
  categories: "M4 6h6v6H4V6Zm10 0h6v6h-6V6ZM4 16h6v2H4v-2Zm10 0h6v2h-6v-2Z",
  rules: "M9 3h6l1 3h3v2h-2l-2 13H7L5 8H3V6h3l1-3Zm2 6v7m2-7v7",
  audit: "M5 4h11l3 3v13H5V4Zm3 6h7m-7 4h7m-7 4h4",
  requests: "M5 4h11l3 3v13H5V4Zm3 6h7m-7 4h7m-7 4h4M15 17l1.5 1.5L20 15",
};

export function NavIcon({ name, className }: { name: NavIconName; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
