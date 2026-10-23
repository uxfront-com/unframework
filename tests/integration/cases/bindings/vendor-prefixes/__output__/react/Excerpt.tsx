import type { CSSProperties } from "react";

export interface ExcerptProps {
  title: string;
  text: string;
  fill: string;
  stroke: string;
}

export interface ExcerptAttributes {
  className?: string;
  style?: CSSProperties;
}

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
    <article className={cx("excerpt", className)} style={style} {...scopeAttributes(attributes)}>
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

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const key of Object.keys(props)) {
    if (key.startsWith("data-uf-")) scope[key] = "";
  }
  return scope;
}
