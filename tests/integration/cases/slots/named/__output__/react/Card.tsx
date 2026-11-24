import { cx } from "./_unframework/cx";
import { scopeAttributes } from "./_unframework/scopeAttributes";
import type { CSSProperties, ReactNode } from "react";

export interface CardSlots {
  header?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
}

export interface CardAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function Card({
  header,
  children,
  footer,
  className,
  style,
  ...attributes
}: CardSlots & CardAttributes) {
  return (
    <article className={cx("card", className)} style={style} {...scopeAttributes(attributes)}>
      <header>{header}</header>
      <div className="body">{children}</div>
      <footer>{footer}</footer>
    </article>
  );
}
