import { cx } from "./_unframework/cx";
import { scopeAttributes } from "./_unframework/scopeAttributes";
import type { CSSProperties, ReactNode } from "react";

export interface CardSlots {
  title?: ReactNode;
  children?: ReactNode;
}

export interface CardAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function Card({
  label,
  title,
  children,
  className,
  style,
  ...attributes
}: { label: string } & CardSlots & CardAttributes) {
  return (
    <section
      className={cx("card", className)}
      aria-label={label}
      style={style}
      {...scopeAttributes(attributes)}
    >
      {title != null ? <header className="title">{title}</header> : null}
      {children != null ? <div className="body">{children}</div> : <p>Empty card</p>}
    </section>
  );
}
