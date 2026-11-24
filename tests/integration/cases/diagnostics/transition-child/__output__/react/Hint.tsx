import type { ComponentPropsWithRef } from "react";

export type HintAttributes = Omit<ComponentPropsWithRef<"p">, "children">;

export function Hint({ className, style, ...attributes }: HintAttributes) {
  return (
    <p className={className} style={style} {...attributes}>
      Hint
    </p>
  );
}
