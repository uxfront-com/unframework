import type { ComponentPropsWithRef } from "react";

export interface Entry {
  id: string;
  label: string;
}

export interface ChecklistProps {
  entries: Entry[];
}

export type ChecklistAttributes = Omit<ComponentPropsWithRef<"ul">, "entries" | "children">;

export default function Checklist({
  entries,
  className,
  style,
  ...attributes
}: ChecklistProps & ChecklistAttributes) {
  return (
    <ul className={cx("checklist", className)} style={style} {...attributes}>
      {entries.map((entry) => (
        <li key={entry.id}>
          <label>
            {entry.label}
            <input name={`note-${entry.id}`} aria-label={`Note for ${entry.label}`} />
          </label>
        </li>
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
