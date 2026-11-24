import Pressable from "./Pressable";
import type { ComponentPropsWithRef } from "react";

export type SaveActionAttributes = Omit<
  ComponentPropsWithRef<typeof Pressable>,
  "text" | "children"
>;

export default function SaveAction({
  text,
  className,
  style,
  ...attributes
}: { text: string } & SaveActionAttributes) {
  return <Pressable text={text} className={cx("save", className)} style={style} {...attributes} />;
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
