import type { CSSProperties } from "react";

export interface PlanProps {
  name: string;
  price: number;
  href: string;
  featured?: boolean;
  note?: string;
}

export interface PlanAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function Plan({
  name,
  price,
  href,
  featured = false,
  note,
  className,
  style,
  ...attributes
}: PlanProps & PlanAttributes) {
  return (
    <article
      className={cx(featured ? "plan featured" : "plan", className)}
      aria-label={name}
      style={style}
      {...scopeAttributes(attributes)}
    >
      <h2>{name}</h2>
      <p>{price} EUR a month</p>
      {note ? <p className="note">{note}</p> : <p className="note">No commitment.</p>}
      <a href={href}>Choose {name}</a>
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
