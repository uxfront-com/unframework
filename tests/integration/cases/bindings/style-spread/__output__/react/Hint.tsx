import { styleObject } from "./_unframework/styleObject";
import type { ComponentPropsWithRef } from "react";

interface HintAttributes {
  id: string;
  style?: string;
}

export interface HintProps {
  text: string;
  attrs: HintAttributes;
}

export type HintAttributes_1 = Omit<ComponentPropsWithRef<"small">, "text" | "attrs" | "children">;

export default function Hint({
  text,
  attrs,
  className,
  style,
  ...attributes
}: HintProps & HintAttributes_1) {
  return (
    <small
      id={attrs.id}
      style={{ ...styleObject(attrs.style), ...style }}
      className={className}
      {...attributes}
    >
      {text}
    </small>
  );
}
