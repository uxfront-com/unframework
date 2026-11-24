import type { ComponentPropsWithRef } from "react";
import "virtual:styleframe.css";
import "./Panel.uf.tsx.css";

export type PanelAttributes = Omit<ComponentPropsWithRef<"section">, "text" | "children">;

export default function Panel({
  text,
  className,
  style,
  ...attributes
}: { text: string } & PanelAttributes) {
  return (
    <section className={cx("panel", className)} style={style} data-uf-b6be1fd3="" {...attributes}>
      <p className="body" data-uf-b6be1fd3="">
        {text}
      </p>
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
