import type { CSSProperties } from "react";

export interface SummaryProps {
  name: string;
  plan: string;
  seats: number;
}

export interface SummaryAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function Summary({
  name,
  plan,
  seats,
  className,
  style,
  ...attributes
}: SummaryProps & SummaryAttributes) {
  return (
    <div
      className={cx("summary", className)}
      style={{ display: "table", borderSpacing: "8px 4px", ...style }}
      {...scopeAttributes(attributes)}
    >
      <div style={{ display: "table-caption", fontWeight: "700" }}>Account</div>
      <div style={{ display: "table-row" }}>
        <span style={{ display: "table-cell" }}>Name</span>
        <span style={{ display: "table-cell" }}>{name}</span>
      </div>
      <div style={{ display: "table-row" }}>
        <span style={{ display: "table-cell" }}>Plan</span>
        <span style={{ display: "table-cell" }}>
          {plan} for {seats} seats
        </span>
      </div>
      <p>
        Billed to <span style={{ display: "table-cell", padding: "0 4px" }}>{name}</span> monthly.
      </p>
    </div>
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
