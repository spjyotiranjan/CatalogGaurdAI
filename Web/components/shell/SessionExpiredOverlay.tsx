"use client";

import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Cards";

interface SessionExpiredOverlayProps {
  open: boolean;
  onDiscard?: () => void;
}

/**
 * Screen 28 — Session Expired. Locks the protected screen after expiry and
 * requires reauthentication before any pending mutation can be submitted.
 * Not dismissible via Escape: a stale session must not silently continue.
 */
export function SessionExpiredOverlay({ open, onDiscard }: SessionExpiredOverlayProps) {
  const router = useRouter();

  return (
    <Modal
      open={open}
      titleId="session-expired-title"
      title="Your session has expired"
      closeOnEscape={false}
      footer={
        <>
          <Button variant="secondary" onClick={onDiscard}>
            Discard changes
          </Button>
          <Button onClick={() => router.push("/login")}>Sign in again</Button>
        </>
      }
    >
      <p>
        For security, the protected workspace was locked after inactivity. Unsaved notes remain only in
        this browser.
      </p>
      <div className="mt-3">
        <Alert tone="warning" title="Sign in again before submitting a decision." />
      </div>
    </Modal>
  );
}
