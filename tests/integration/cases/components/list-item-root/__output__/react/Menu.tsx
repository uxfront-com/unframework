import Item from "./Item";
import { scopeAttributes } from "./_unframework/scopeAttributes";
import type { CSSProperties } from "react";

export interface MenuAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function Menu({
  entries,
  className,
  style,
  ...attributes
}: { entries: string[] } & MenuAttributes) {
  return (
    <ul aria-label="Menu" className={className} style={style} {...scopeAttributes(attributes)}>
      {entries.map((entry) => (
        <Item key={entry} label={entry} />
      ))}
    </ul>
  );
}
