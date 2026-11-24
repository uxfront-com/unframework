import { cx } from "./_unframework/cx";
import { scopeAttributes } from "./_unframework/scopeAttributes";
import type { CSSProperties } from "react";

export interface Entry {
  id: string;
  label: string;
}

export interface ChecklistProps {
  entries: Entry[];
}

export interface ChecklistAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function Checklist({
  entries,
  className,
  style,
  ...attributes
}: ChecklistProps & ChecklistAttributes) {
  return (
    <ul className={cx("checklist", className)} style={style} {...scopeAttributes(attributes)}>
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
