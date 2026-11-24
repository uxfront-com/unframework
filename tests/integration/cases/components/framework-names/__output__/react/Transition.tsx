import { cx } from "./_unframework/cx";
import { scopeAttributes } from "./_unframework/scopeAttributes";
import type { CSSProperties } from "react";

export interface TransitionAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function Transition({
  step,
  className,
  style,
  ...attributes
}: { step: string } & TransitionAttributes) {
  return (
    <p className={cx("step", className)} style={style} {...scopeAttributes(attributes)}>
      Step: {step}
    </p>
  );
}
