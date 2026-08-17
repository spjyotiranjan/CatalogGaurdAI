"use client";

import { useRef, useState } from "react";
import type { DragEvent } from "react";
import { ACCEPTED_FEED_EXTENSIONS, MAX_FEED_UPLOAD_BYTES } from "@/lib/types/feed";
import { cn } from "@/lib/utils/cn";

interface DropzoneProps {
  onFileSelected: (file: File) => void;
  disabled?: boolean;
}

/**
 * Local file selection only — no upload happens here. Extension/size
 * preflight is owned by the parent via lib/fixtures/feeds.ts#preflightFile
 * so the same check governs both the drop path and the "Choose file" path.
 */
export function Dropzone({ onFileSelected, disabled }: DropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragActive(false);
    if (disabled) return;
    const file = e.dataTransfer.files?.[0];
    if (file) onFileSelected(file);
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setDragActive(true);
      }}
      onDragLeave={() => setDragActive(false)}
      onDrop={handleDrop}
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-[12px] border-2 border-dashed px-6 py-10 text-center transition-colors",
        dragActive ? "border-[var(--cg-purple)] bg-[var(--cg-purple-soft)]" : "border-[var(--cg-border-strong)]",
        disabled && "opacity-60"
      )}
    >
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--cg-purple-soft)]">
        <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
          <path
            d="M10 3v10m0-10 4 4m-4-4-4 4M4 15v1a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-1"
            stroke="var(--cg-purple)"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      <div>
        <p className="text-[13.5px] font-medium text-[var(--cg-text-primary)]">Drop a seller feed here</p>
        <p className="text-[12px] text-[var(--cg-text-muted)]">or choose a file from this device</p>
      </div>
      <button
        type="button"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        className="h-9 rounded-[10px] border border-[var(--cg-border-strong)] px-3.5 text-[12.5px] font-semibold text-[var(--cg-text-primary)] hover:bg-white disabled:cursor-not-allowed"
      >
        Choose file
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_FEED_EXTENSIONS.join(",")}
        className="cg-sr-only"
        disabled={disabled}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFileSelected(file);
          e.target.value = "";
        }}
      />
      <p className="text-[11px] text-[var(--cg-text-muted)]">
        CSV only · maximum {Math.round(MAX_FEED_UPLOAD_BYTES / (1024 * 1024))} MB
      </p>
    </div>
  );
}
