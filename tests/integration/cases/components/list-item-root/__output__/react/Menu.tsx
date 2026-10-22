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

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const key of Object.keys(props)) {
    if (key.startsWith("data-uf-")) scope[key] = "";
  }
  return scope;
}
