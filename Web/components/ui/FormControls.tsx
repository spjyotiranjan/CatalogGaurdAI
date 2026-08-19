import { forwardRef, useId } from "react";
import type { InputHTMLAttributes, SelectHTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  hint?: string;
}

/**
 * Server field errors are authoritative and map to fieldPath (3.5.5).
 * This component only renders the client-facing presentation; it never
 * decides validity itself in later phases.
 */
export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  { label, error, hint, id, className, ...props },
  ref
) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  const errorId = `${fieldId}-error`;
  const hintId = `${fieldId}-hint`;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={fieldId} className="text-[13px] font-medium text-[var(--cg-text-secondary)]">
        {label}
      </label>
      <input
        ref={ref}
        id={fieldId}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : hint ? hintId : undefined}
        className={cn(
          "h-11 rounded-[10px] border bg-white px-3.5 text-[14px] text-[var(--cg-text-primary)]",
          "placeholder:text-[var(--cg-text-muted)] outline-none transition-colors",
          error
            ? "border-[var(--cg-red)] focus:border-[var(--cg-red)]"
            : "border-[var(--cg-border-strong)] focus:border-[var(--cg-purple)]",
          className
        )}
        {...props}
      />
      {error ? (
        <p id={errorId} className="text-[12.5px] text-[var(--cg-red)]">
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="text-[12.5px] text-[var(--cg-text-muted)]">
          {hint}
        </p>
      ) : null}
    </div>
  );
});

interface CheckboxFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
}

export const CheckboxField = forwardRef<HTMLInputElement, CheckboxFieldProps>(function CheckboxField(
  { label, id, className, ...props },
  ref
) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  return (
    <label htmlFor={fieldId} className="flex items-center gap-2 text-[13px] text-[var(--cg-text-secondary)]">
      <input
        ref={ref}
        id={fieldId}
        type="checkbox"
        className={cn("h-4 w-4 rounded border-[var(--cg-border-strong)] accent-[var(--cg-purple)]", className)}
        {...props}
      />
      {label}
    </label>
  );
});

interface SelectOption {
  value: string;
  label: string;
}

interface SelectFieldProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  options: SelectOption[];
  error?: string;
  hint?: string;
}

export const SelectField = forwardRef<HTMLSelectElement, SelectFieldProps>(function SelectField(
  { label, options, error, hint, id, className, ...props },
  ref
) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  const errorId = `${fieldId}-error`;
  const hintId = `${fieldId}-hint`;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={fieldId} className="text-[13px] font-medium text-[var(--cg-text-secondary)]">
        {label}
      </label>
      <select
        ref={ref}
        id={fieldId}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : hint ? hintId : undefined}
        className={cn(
          "h-11 rounded-[10px] border bg-white px-3.5 text-[14px] text-[var(--cg-text-primary)]",
          "outline-none transition-colors cursor-pointer",
          error
            ? "border-[var(--cg-red)] focus:border-[var(--cg-red)]"
            : "border-[var(--cg-border-strong)] focus:border-[var(--cg-purple)]",
          className
        )}
        {...props}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error ? (
        <p id={errorId} className="text-[12.5px] text-[var(--cg-red)]">
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="text-[12.5px] text-[var(--cg-text-muted)]">
          {hint}
        </p>
      ) : null}
    </div>
  );
});
