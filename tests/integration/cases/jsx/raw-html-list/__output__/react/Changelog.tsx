import { cx } from "./_unframework/cx";
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
