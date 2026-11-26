import { cx } from "./_unframework/cx";
import type { ComponentPropsWithRef } from "react";

export interface StepListProps {
  title: string;
  steps: string[];
}

export type StepListAttributes = Omit<ComponentPropsWithRef<"ol">, "title" | "steps" | "children">;

export default function StepList({
  title,
  steps,
  className,
  style,
  ...attributes
}: StepListProps & StepListAttributes) {
  return (
    <ol className={cx("step-list", className)} aria-label={title} style={style} {...attributes}>
      {steps.map((step, index) => (
        <li key={index} data-step={index + 1}>
          Step {index + 1}: {step}
        </li>
      ))}
    </ol>
  );
}
