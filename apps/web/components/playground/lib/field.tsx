import type React from "react";

/**
 * Reusable form field wrapper: label + required indicator + children slot.
 *
 * Extracted from the previous monolithic Playground component so the image
 * and video workbenches share a consistent label/control rhythm.
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

/**
 * Shared Tailwind class strings for `<select>` and `<input>` controls, so
 * the image and video workbenches stay visually consistent without
 * repeating class lists.
 */
export const selectClassName =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 shadow-sm transition outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100";

export const inputClassName =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 shadow-sm transition outline-none placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100";

export const textareaClassName =
  "w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 shadow-sm transition outline-none placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100";
