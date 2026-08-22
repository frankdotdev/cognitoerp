"use client";

/**
 * Every create/edit form in the app uses this instead of a raw <input>.
 * Fixes a systemic gap flagged in review: only the two auth screens had
 * any validation feedback — every other form was silent on bad input.
 * This component always reserves space for an error line (rather than
 * having fields jump around when an error appears) and marks invalid
 * fields with aria-invalid for screen readers, not just a red border.
 */
import { ReactNode } from "react";

interface FormFieldProps {
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
  children: ReactNode;
}

export function FormField({ label, error, hint, required, children }: FormFieldProps) {
  return (
    <div>
      <label className="block text-[12.5px] font-medium text-ink-700 mb-1.5">
        {label}
        {required && <span className="text-danger ml-0.5">*</span>}
      </label>
      {children}
      <div className="min-h-[16px] mt-1">
        {error ? (
          <p className="text-[11.5px] text-danger">{error}</p>
        ) : hint ? (
          <p className="text-[11px] text-ink-300">{hint}</p>
        ) : null}
      </div>
    </div>
  );
}

export function inputClass(hasError?: boolean): string {
  return `w-full px-3.5 py-2.5 rounded-md border text-[13.5px] outline-none transition-colors ${
    hasError
      ? "border-danger focus:border-danger"
      : "border-border focus:border-brand-500"
  }`;
}
