import { cx } from "./_unframework/cx";
import { scopeAttributes } from "./_unframework/scopeAttributes";
import type { CSSProperties } from "react";

export interface Entry {
  id: number;
  html: string;
}

export interface ChangelogProps {
  entries: Entry[];
}

export interface ChangelogAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function Changelog({
  entries,
  className,
  style,
  ...attributes
}: ChangelogProps & ChangelogAttributes) {
  return (
    <ul className={cx("changelog", className)} style={style} {...scopeAttributes(attributes)}>
      {entries.map((entry) => (
        <li key={entry.id} dangerouslySetInnerHTML={{ __html: entry.html }} />
      ))}
    </ul>
  );
}
