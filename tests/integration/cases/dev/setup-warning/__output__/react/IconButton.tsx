import type { ComponentPropsWithRef } from "react";

export type IconButtonAttributes = Omit<ComponentPropsWithRef<"button">, "label" | "children">;

export default function IconButton({
  label,
  className,
  style,
  ...attributes
}: { label?: string } & IconButtonAttributes) {
  if (process.env.NODE_ENV !== "production") {
    if (!label) console.warn("IconButton has no accessible name: pass it a `label`.");
  }

  return (
    <button type="button" aria-label={label} className={className} style={style} {...attributes}>
      <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
        <path d="M8 1l2 5h5l-4 3 2 6-5-4-5 4 2-6-4-3h5z" />
      </svg>
    </button>
  );
}
