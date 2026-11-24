import type { ComponentPropsWithoutRef, Ref } from "react";

export type HeadingAttributes = Omit<
  ComponentPropsWithoutRef<"h1"> & ComponentPropsWithoutRef<"h2"> & ComponentPropsWithoutRef<"h3">,
  "tag" | "text" | "children"
> & { ref?: Ref<HTMLHeadingElement> };

export default function Heading({
  tag,
  text,
  className,
  style,
  ...attributes
}: { tag: "h1" | "h2" | "h3"; text: string } & HeadingAttributes) {
  const Tag = tag;

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
