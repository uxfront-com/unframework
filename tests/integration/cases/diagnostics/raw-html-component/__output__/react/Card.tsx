import { cx } from "./_unframework/cx";
import { scopeAttributes } from "./_unframework/scopeAttributes";
import type { CSSProperties } from "react";

export interface CardAttributes {
  className?: string;
  style?: CSSProperties;
}

export function Card({
  heading,
  className,
  style,
  ...attributes
}: { heading: string } & CardAttributes) {
  return (
    <section className={cx("card", className)} style={style} {...scopeAttributes(attributes)}>
      <h2>{heading}</h2>
    </section>
  );
}
