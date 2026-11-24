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

/** Joins class names, and the keys of an object's truthy entries, into one `className`. */
function cx(...parts: unknown[]): string {
  const names: string[] = [];
  for (const part of parts) {
    if (typeof part === "string") {
      if (part) names.push(part);
    } else if (part && typeof part === "object") {
      for (const [key, on] of Object.entries(part)) {
        if (on) names.push(key);
      }
    }
  }
  return names.join(" ");
}
