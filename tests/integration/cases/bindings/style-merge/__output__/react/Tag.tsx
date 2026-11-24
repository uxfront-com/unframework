import type { ComponentPropsWithRef } from "react";

export interface TagProps {
  label: string;
  colour?: string;
  weight?: number;
  indent?: string;
}

export type TagAttributes = Omit<
  ComponentPropsWithRef<"span">,
  "label" | "colour" | "weight" | "indent" | "children"
>;

export default function Tag({
  label,
  colour,
  weight,
  indent,
  className,
  style,
  ...attributes
}: TagProps & TagAttributes) {
  return (
    <span
      className={cx("tag", className)}
      style={{
        display: "inline-block",
        padding: "2px 8px",
        borderStyle: "solid",
        borderWidth: "1px",
        borderColor: colour ?? "#5a5a5a",
        color: colour,
        fontWeight: weight,
        marginLeft: indent,
        ...style,
      }}
      {...attributes}
    >
      {label}
    </span>
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
