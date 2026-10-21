import type { CSSProperties } from "react";

export interface CardAttributes {
  className?: string;
  style?: CSSProperties;
}

export function Card({ className, style, ...attributes }: CardAttributes) {
  return (
    <p className={className} style={style} {...scopeAttributes(attributes)}>
      Card
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
