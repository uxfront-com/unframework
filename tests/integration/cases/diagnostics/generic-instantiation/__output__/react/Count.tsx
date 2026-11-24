import { scopeAttributes } from "./_unframework/scopeAttributes";
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
