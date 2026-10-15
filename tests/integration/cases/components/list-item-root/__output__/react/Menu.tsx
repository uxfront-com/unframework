import Item from "./Item";
import type { CSSProperties } from "react";

export interface MenuAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function Menu({
  entries,
  className,
  style,
}: { entries: string[] } & MenuAttributes) {
  return (
    <ul aria-label="Menu" className={className} style={style}>
      {entries.map((entry) => (
        <Item key={entry} label={entry} />
      ))}
    </ul>
  );
}
