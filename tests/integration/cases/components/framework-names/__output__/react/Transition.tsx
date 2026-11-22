import type { ComponentPropsWithRef } from "react";

export type TransitionAttributes = Omit<ComponentPropsWithRef<"p">, "step" | "children">;

export default function Transition({
  step,
  className,
  style,
  ...attributes
}: { step: string } & TransitionAttributes) {
  return (
    <p className={cx("step", className)} style={style} {...attributes}>
      Step: {step}
    </p>
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
