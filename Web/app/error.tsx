"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { StatusScreen } from "@/components/shell/StatusScreen";
import { Button } from "@/components/ui/Button";
import { makeCorrelationId } from "@/lib/fixtures/session";

/**
 * Screen 27 — System Error. Shared state, route /error.
 * Reports a recoverable failure, preserves a reference ID, and confirms
 * that no mutation occurred. Next.js requires error boundaries to be
 * client components; `reset()` retries rendering the segment.
 */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const reference = useMemo(() => makeCorrelationId(), []);
  const router = useRouter();

  return (
    <StatusScreen
      code="500"
      codeTone="amber"
      title="Something went wrong"
      description="The request could not be completed. Your changes were not submitted."
      meta={`Reference: ${reference}`}
      footnote="No customer-facing catalog data was changed."
    >
      <div className="mt-6 flex items-center justify-center gap-2">
        <Button variant="secondary" onClick={() => router.push("/login")}>
          View system status
        </Button>
        <Button onClick={() => reset()}>Try again</Button>
      </div>
    </StatusScreen>
  );
}
