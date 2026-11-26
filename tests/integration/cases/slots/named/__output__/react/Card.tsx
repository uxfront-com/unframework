import { cx } from "./_unframework/cx";
import type { ComponentPropsWithRef, ReactNode } from "react";

export interface CardSlots {
  header?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
}

export type CardAttributes = Omit<
  ComponentPropsWithRef<"article">,
  "header" | "children" | "footer"
>;

export default function Card({
  header,
  children,
  footer,
  className,
  style,
  ...attributes
}: CardSlots & CardAttributes) {
  return (
    <article className={cx("card", className)} style={style} {...attributes}>
      <header>{header}</header>
      <div className="body">{children}</div>
      <footer>{footer}</footer>
    </article>
  );
}
