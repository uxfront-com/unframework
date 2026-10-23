import type { CSSProperties } from "react";
import { button } from "virtual:styleframe";
import "virtual:styleframe.css";
import "./Card.uf.tsx.css";

export interface CardAttributes {
  className?: string;
  style?: CSSProperties;
}

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
      {...scopeAttributes(attributes)}
    >
      <h2 className="title" data-uf-9cfb6163="">
        {title}
      </h2>
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
