import type { CSSProperties, ComponentPropsWithRef } from "react";

export interface CalloutProps {
  heading: string;
  body: string;
}

export type CalloutAttributes = Omit<
  ComponentPropsWithRef<"aside">,
  "heading" | "body" | "children"
>;

export default function Callout({
  heading,
  body,
  className,
  style,
  ...attributes
}: CalloutProps & CalloutAttributes) {
  return (
    <aside
      className={cx("callout", className)}
      aria-label={heading}
      style={
        {
          "--callout-accent": "#1f4d7a",
          borderLeft: "4px solid var(--callout-accent)",
          padding: "8px 12px",
          color: "#1a1a1a",
          ...style,
        } as CSSProperties
      }
      {...attributes}
    >
      <p style={{ margin: "0", fontWeight: "700" }}>{heading}</p>
      <p style={{ margin: "4px 0 0" }}>{body}</p>
    </aside>
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
