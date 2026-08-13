import Link from "next/link";
import { StatusScreen } from "@/components/shell/StatusScreen";

/**
 * Screen 26 — Page Not Found. Shared state, route /404.
 * Recovers from an invalid or removed route without implying an
 * authorization decision (that's screen 24 / Access Denied instead).
 */
export default function NotFound() {
  return (
    <StatusScreen
      code="404"
      codeTone="purple"
      title="Page not found"
      description="The requested page does not exist or may have moved."
      meta="Check the URL or return to a known workspace."
      footnote="No customer-facing catalog data was changed."
    >
      <div className="mt-6 flex items-center justify-center gap-2">
        <Link
          href="/seller/products"
          className="inline-flex h-11 items-center justify-center rounded-[10px] border border-[var(--cg-border-strong)] px-4 text-[13.5px] font-semibold text-[var(--cg-text-primary)] hover:bg-[var(--cg-surface)]"
        >
          View catalog
        </Link>
        <Link
          href="/login"
          className="inline-flex h-11 items-center justify-center rounded-[10px] bg-[var(--cg-purple)] px-4 text-[13.5px] font-semibold text-white hover:bg-[var(--cg-purple-hover)]"
        >
          Go to dashboard
        </Link>
      </div>
    </StatusScreen>
  );
}
