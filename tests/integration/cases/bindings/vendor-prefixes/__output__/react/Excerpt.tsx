import { cx } from "./_unframework/cx";
import type { ComponentPropsWithRef } from "react";

export interface ExcerptProps {
  title: string;
  text: string;
  fill: string;
  stroke: string;
}

export type ExcerptAttributes = Omit<
  ComponentPropsWithRef<"article">,
  "title" | "text" | "fill" | "stroke" | "children"
>;

export default function Excerpt({
  title,
  text,
  fill,
  stroke,
  className,
  style,
  ...attributes
}: ExcerptProps & ExcerptAttributes) {
  return (
    <article className={cx("excerpt", className)} style={style} {...attributes}>
      <h2
        style={{
          WebkitTextFillColor: fill,
          WebkitTextStrokeColor: stroke,
          WebkitTextStrokeWidth: "1px",
          color: "rgb(0, 0, 0)",
        }}
      >
        {title}
      </h2>
      <p
        style={{
          display: "-webkit-box",
          WebkitBoxOrient: "vertical",
          WebkitLineClamp: "2",
          overflow: "hidden",
          width: "240px",
        }}
      >
        {text}
      </p>
    </article>
  );
}
