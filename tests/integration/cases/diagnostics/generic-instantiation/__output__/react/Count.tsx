import type { CSSProperties } from "react";

interface Fruit {
  id: string;
  name: string;
  children: Fruit[];
}

export interface CountAttributes {
  className?: string;
  style?: CSSProperties;
}

export function Count({
  items,
  className,
  style,
  ...attributes
}: { items: Fruit[] } & CountAttributes) {
  return (
    <p className={className} style={style} {...scopeAttributes(attributes)}>
      {items.length} fruits
    </p>
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
