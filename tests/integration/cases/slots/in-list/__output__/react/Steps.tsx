import { cx } from "./_unframework/cx";
import { scopeAttributes } from "./_unframework/scopeAttributes";
import type { CSSProperties, ReactNode } from "react";

export interface StepsSlots {
  marker?: ReactNode;
}

export interface StepsAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function Steps({
  steps,
  marker,
  className,
  style,
  ...attributes
}: { steps: string[] } & StepsSlots & StepsAttributes) {
  return (
    <ol className={cx("steps", className)} style={style} {...scopeAttributes(attributes)}>
      {steps.map((step) => (
        <li key={step}>
          {marker}
          {step}
        </li>
      ))}
    </ol>
  );
}
