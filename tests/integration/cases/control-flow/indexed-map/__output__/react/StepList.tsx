import type { CSSProperties } from "react";

export interface StepListProps {
  title: string;
  steps: string[];
}

export interface StepListAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function StepList({
  title,
  steps,
  className,
  style,
}: StepListProps & StepListAttributes) {
  return (
    <ol className={cx("step-list", className)} aria-label={title} style={style}>
      {steps.map((step, index) => (
        <li key={index} data-step={index + 1}>
          Step {index + 1}: {step}
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
