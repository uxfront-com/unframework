import type { ComponentPropsWithRef } from "react";

interface Fruit {
  id: string;
  name: string;
  children: Fruit[];
}

export type CountAttributes = Omit<ComponentPropsWithRef<"p">, "items" | "children">;

export function Count({
  items,
  className,
  style,
  ...attributes
}: { items: Fruit[] } & CountAttributes) {
  return (
    <p className={className} style={style} {...attributes}>
      {items.length} fruits
    </p>
  );
}
