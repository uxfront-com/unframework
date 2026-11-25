import { cx } from "./_unframework/cx";
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
