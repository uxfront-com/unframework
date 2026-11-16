import type { CSSProperties } from "react";

export interface ItemAttributes {
  className?: string;
  style?: CSSProperties;
}

export function Item({ className, style, ...attributes }: ItemAttributes) {
  return (
    <span className={className} style={style} {...scopeAttributes(attributes)}>
      Item
    </span>
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
