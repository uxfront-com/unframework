import { cx } from "./_unframework/cx";
import type { ComponentPropsWithRef } from "react";
import { button } from "virtual:styleframe";
import "virtual:styleframe.css";
import "./Card.uf.tsx.css";

export type CardAttributes = Omit<ComponentPropsWithRef<"article">, "title" | "children">;

export default function Card({
  title,
  className,
  style,
  ...attributes
}: { title: string } & CardAttributes) {
  return (
    <article
      className={cx("card", button({ size: "lg", tone: "primary" }), className)}
      style={style}
      data-uf-9cfb6163=""
      {...attributes}
    >
      <h2 className="title" data-uf-9cfb6163="">
        {title}
      </h2>
    </article>
  );
}
