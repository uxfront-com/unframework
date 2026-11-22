import type { ComponentPropsWithRef } from "react";

export type ItemAttributes = Omit<ComponentPropsWithRef<"span">, "children">;

export function Item({ className, style, ...attributes }: ItemAttributes) {
  return (
    <span className={className} style={style} {...attributes}>
      Item
    </span>
  );
}
