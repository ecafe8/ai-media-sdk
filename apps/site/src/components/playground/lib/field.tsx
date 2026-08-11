import type React from "react";

/**
 * Reusable form field wrapper: label + required indicator + children slot.
 */
export interface FieldProps {
  readonly label: string;
  readonly required?: boolean;
  readonly children: React.ReactNode;
}

export function Field({ label, required, children }: FieldProps) {
  return (
    // biome-ignore lint/a11y/noLabelWithoutControl: Field is a layout primitive that wraps its control via children, not a form label
    <label className="block font-medium text-slate-700 text-sm">
      {label} {required ? <span className="text-red-500">*</span> : null}
      <div className="mt-2 font-normal">{children}</div>
    </label>
  );
}
