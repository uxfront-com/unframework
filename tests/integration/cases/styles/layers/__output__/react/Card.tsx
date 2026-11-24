import { cx } from "./_unframework/cx";
import type { ComponentPropsWithRef } from "react";
import "./Card.uf.tsx.css";

export type CardAttributes = Omit<ComponentPropsWithRef<"section">, "title" | "children">;

export default function Card({
  title,
  className,
  style,
  ...attributes
}: { title: string } & CardAttributes) {
  return (
    <section className={cx("card", className)} style={style} data-uf-bb60e985="" {...attributes}>
      <h2 className="title" data-uf-bb60e985="">
        {title}
      </h2>
    </section>
  );
}
