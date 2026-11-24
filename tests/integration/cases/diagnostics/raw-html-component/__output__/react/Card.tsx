import { cx } from "./_unframework/cx";
import type { ComponentPropsWithRef } from "react";

export type CardAttributes = Omit<ComponentPropsWithRef<"section">, "heading" | "children">;

export function Card({
  heading,
  className,
  style,
  ...attributes
}: { heading: string } & CardAttributes) {
  return (
    <section className={cx("card", className)} style={style} {...attributes}>
      <h2>{heading}</h2>
    </section>
  );
}
