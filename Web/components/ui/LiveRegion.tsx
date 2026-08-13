"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

interface ToastItem {
  id: string;
  tone: "info" | "success" | "warning" | "danger";
  message: string;
}

interface ToastContextValue {
  announce: (message: string, tone?: ToastItem["tone"]) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const TOAST_STYLES: Record<ToastItem["tone"], string> = {
  info: "border-[var(--cg-blue)]/30 bg-[var(--cg-blue-soft)]",
  success: "border-[var(--cg-green)]/30 bg-[var(--cg-green-soft)]",
  warning: "border-[var(--cg-amber)]/30 bg-[var(--cg-amber-soft)]",
  danger: "border-[var(--cg-red)]/30 bg-[var(--cg-red-soft)]",
};

/**
 * Provides a polite live region for async status announcements (upload
 * progress, validation completion, decision results — 3.5.12) plus a
 * lightweight toast stack. USER-visible only; never a substitute for the
 * backend-owned AUDIT_LOG.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const announce = useCallback((message: string, tone: ToastItem["tone"] = "info") => {
    const id = `${Date.now()}-${Math.random().toString(16).slice(2, 6)}`;
    setToasts((prev) => [...prev, { id, tone, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const value = useMemo(() => ({ announce }), [announce]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div aria-live="polite" role="status" className="cg-sr-only">
        {toasts.map((t) => t.message).join(". ")}
      </div>
      <div className="pointer-events-none fixed bottom-6 right-6 z-[60] flex flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              "pointer-events-auto min-w-[240px] rounded-[10px] border px-4 py-3 text-[13px] shadow-md",
              TOAST_STYLES[t.tone]
            )}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return ctx;
}
