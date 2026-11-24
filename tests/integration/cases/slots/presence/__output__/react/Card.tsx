import { cx } from "./_unframework/cx";
import type { ComponentPropsWithRef, ReactNode } from "react";

export interface CardSlots {
  title?: ReactNode;
  children?: ReactNode;
}

export type CardAttributes = Omit<ComponentPropsWithRef<"section">, "label" | "title" | "children">;

export default function Card({
  label,
  title,
  children,
  className,
  style,
  ...attributes
}: { label: string } & CardSlots & CardAttributes) {
  return (
    <section className={cx("card", className)} aria-label={label} style={style} {...attributes}>
      {title != null ? <header className="title">{title}</header> : null}
      {children != null ? <div className="body">{children}</div> : <p>Empty card</p>}
    </section>
  );
}
