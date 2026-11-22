import { cx } from "./_unframework/cx";
import { scopeAttributes } from "./_unframework/scopeAttributes";
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
  ...attributes
}: StepListProps & StepListAttributes) {
  return (
    <ol
      className={cx("step-list", className)}
      aria-label={title}
      style={style}
      {...scopeAttributes(attributes)}
    >
      {steps.map((step, index) => (
        <li key={index} data-step={index + 1}>
          Step {index + 1}: {step}
        </li>
      ))}
    </ol>
  );
}
