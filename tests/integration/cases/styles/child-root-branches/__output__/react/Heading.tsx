import type { ComponentPropsWithoutRef, Ref } from "react";

export type HeadingAttributes = Omit<
  ComponentPropsWithoutRef<"h2"> & ComponentPropsWithoutRef<"h3">,
  "big" | "text" | "children"
> & { ref?: Ref<HTMLHeadingElement> };

export default function Heading({
  big,
  text,
  className,
  style,
  ...attributes
}: { big: boolean; text: string } & HeadingAttributes) {
  const Tag = big ? "h2" : "h3";

  return (
    <Tag className={cx("heading", className)} style={style} {...attributes}>
      {text}
    </Tag>
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
