import type { ComponentPropsWithRef } from "react";

export interface Entry {
  id: number;
  html: string;
}

export interface ChangelogProps {
  entries: Entry[];
}

export type ChangelogAttributes = Omit<ComponentPropsWithRef<"ul">, "entries" | "children">;

export default function Changelog({
  entries,
  className,
  style,
  ...attributes
}: ChangelogProps & ChangelogAttributes) {
  return (
    <ul className={cx("changelog", className)} style={style} {...attributes}>
      {entries.map((entry) => (
        <li key={entry.id} dangerouslySetInnerHTML={{ __html: entry.html }} />
      ))}
    </ul>
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
