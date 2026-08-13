"use client";

import { useRouter } from "next/navigation";
import { StatusScreen } from "@/components/shell/StatusScreen";
import { Button } from "@/components/ui/Button";

/**
 * Screen 24 — Access Denied. Shared state, route /403.
 * Explains that the current role lacks permission without exposing
 * protected data. This page never decides authorization; it renders
 * whatever the server already refused.
 */
export default function AccessDeniedPage() {
  const router = useRouter();

  return (
    <StatusScreen
      code="403"
      codeTone="red"
      title="Access denied"
      description="Your current role cannot access this workspace."
      meta="Required role: Administrator"
      footnote="No customer-facing catalog data was changed."
    >
      <div className="mt-6 flex items-center justify-center gap-2">
        <Button variant="secondary" onClick={() => router.push("/login")}>
          Request access
        </Button>
        <Button onClick={() => router.back()}>Return to dashboard</Button>
      </div>
    </StatusScreen>
  );
}
