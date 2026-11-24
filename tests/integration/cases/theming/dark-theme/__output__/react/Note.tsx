import type { ComponentPropsWithRef } from "react";
import "virtual:styleframe.css";

export type NoteAttributes = Omit<ComponentPropsWithRef<"p">, "text" | "children">;

export default function Note({
  text,
  className,
  style,
  ...attributes
}: { text: string } & NoteAttributes) {
  return (
    <p
      className={cx("_padding:md _background-color:surface _color:text", className)}
      style={style}
      {...attributes}
    >
      {text}
    </p>
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
