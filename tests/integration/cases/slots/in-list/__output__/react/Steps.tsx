import { cx } from "./_unframework/cx";
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
