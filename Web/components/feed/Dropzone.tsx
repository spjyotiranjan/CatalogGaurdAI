"use client";

import { useRef, useState } from "react";
import type { DragEvent } from "react";
import { cn } from "@/lib/utils/cn";

interface DropzoneProps { onFileSelected: (file: File) => void; disabled?: boolean; }

export function Dropzone({ onFileSelected, disabled }: DropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  function handleDrop(event: DragEvent<HTMLDivElement>) { event.preventDefault(); setDragActive(false); if (!disabled) { const file = event.dataTransfer.files?.[0]; if (file) onFileSelected(file); } }
  return <div onDragOver={(event) => { event.preventDefault(); if (!disabled) setDragActive(true); }} onDragLeave={() => setDragActive(false)} onDrop={handleDrop} className={cn("flex flex-col items-center justify-center gap-3 rounded-[12px] border-2 border-dashed px-6 py-10 text-center transition-colors", dragActive ? "border-[var(--cg-purple)] bg-[var(--cg-purple-soft)]" : "border-[var(--cg-border-strong)]", disabled && "opacity-60")}>
    <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--cg-purple-soft)]" aria-hidden="true">↑</span>
    <div><p className="text-[13.5px] font-medium text-[var(--cg-text-primary)]">Drop a seller feed here</p><p className="text-[12px] text-[var(--cg-text-muted)]">or choose a file from this device</p></div>
    <button type="button" disabled={disabled} onClick={() => inputRef.current?.click()} className="h-9 rounded-[10px] border border-[var(--cg-border-strong)] px-3.5 text-[12.5px] font-semibold text-[var(--cg-text-primary)] hover:bg-white disabled:cursor-not-allowed">Choose file</button>
    <input ref={inputRef} type="file" accept=".csv,text/csv" className="cg-sr-only" disabled={disabled} onChange={(event) => { const file = event.target.files?.[0]; if (file) onFileSelected(file); event.target.value = ""; }} />
    <p className="text-[11px] text-[var(--cg-text-muted)]">CSV only · the server validates the final file size and structure</p>
  </div>;
}
