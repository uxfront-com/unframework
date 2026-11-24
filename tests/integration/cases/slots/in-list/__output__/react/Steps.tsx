import type { ComponentPropsWithRef, ReactNode } from "react";

export interface StepsSlots {
  marker?: ReactNode;
}

export type StepsAttributes = Omit<ComponentPropsWithRef<"ol">, "steps" | "marker" | "children">;

export default function Steps({
  steps,
  marker,
  className,
  style,
  ...attributes
}: { steps: string[] } & StepsSlots & StepsAttributes) {
  return (
    <ol className={cx("steps", className)} style={style} {...attributes}>
      {steps.map((step) => (
        <li key={step}>
          {marker}
          {step}
        </li>
      ))}
    </ol>
  );
}

/** Joins class names, and the keys of an object's truthy entries, into one `className`. */
function cx(...parts: unknown[]): string {
  const names: string[] = [];
  for (const part of parts) {
    if (typeof part === "string") {
      if (part) names.push(part);
    } else if (part && typeof part === "object") {
      for (const [key, on] of Object.entries(part)) {
        if (on) names.push(key);
      }
    }
  }
  return names.join(" ");
}
