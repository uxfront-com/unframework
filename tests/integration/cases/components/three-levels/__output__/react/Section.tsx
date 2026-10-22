import Heading from "./Heading";
import type { CSSProperties } from "react";

export interface SectionAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function Section({
  title,
  body,
  className,
  style,
  ...attributes
}: { title: string; body: string } & SectionAttributes) {
  return (
    <section className={cx("section", className)} style={style} {...scopeAttributes(attributes)}>
      <Heading text={title} />
      <p>{body}</p>
    </section>
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
