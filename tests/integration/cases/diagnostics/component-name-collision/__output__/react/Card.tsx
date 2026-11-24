import type { ComponentPropsWithRef } from "react";

export type CardAttributes = Omit<ComponentPropsWithRef<"p">, "children">;

export function Card({ className, style, ...attributes }: CardAttributes) {
  return (
    <p className={className} style={style} {...attributes}>
      Card
    </p>
  );
}
