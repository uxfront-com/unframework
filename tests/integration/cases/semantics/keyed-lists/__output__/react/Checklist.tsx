import { cx } from "./_unframework/cx";
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
