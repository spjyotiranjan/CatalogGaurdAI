"use client";

import { useEffect, useRef } from "react";
import type { ReactNode } from "react";

interface ModalProps {
  open: boolean;
  titleId: string;
  title: string;
  children: ReactNode;
  onClose?: () => void;
  /** Destructive/irreversible-adjacent modals (e.g. session expired) can disable Escape-to-close. */
  closeOnEscape?: boolean;
  footer?: ReactNode;
}

/**
 * Dialogs trap focus, close with Escape when safe, and restore focus to the
 * opening control (3.5.12). Session Expired (screen 28) reuses this with
 * closeOnEscape=false since it must not be dismissed without a decision.
 */
export function Modal({ open, titleId, title, children, onClose, closeOnEscape = true, footer }: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && closeOnEscape) {
        onClose?.();
      }
      if (e.key === "Tab" && dialogRef.current) {
        const focusables = dialogRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      previouslyFocused.current?.focus();
    };
  }, [open, closeOnEscape, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--cg-ink)]/60 px-4">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="w-full max-w-md rounded-[12px] bg-white p-6 shadow-xl outline-none"
      >
        <h2 id={titleId} className="text-[16px] font-semibold text-[var(--cg-text-primary)]">
          {title}
        </h2>
        <div className="mt-2 text-[13.5px] text-[var(--cg-text-secondary)]">{children}</div>
        {footer ? <div className="mt-5 flex items-center justify-end gap-2">{footer}</div> : null}
      </div>
    </div>
  );
}
