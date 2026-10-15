import type { CSSProperties } from "react";

export interface TransitionAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function Transition({
  step,
  className,
  style,
}: { step: string } & TransitionAttributes) {
  return (
    <p className={cx("step", className)} style={style}>
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
