import { cx } from "./_unframework/cx";
import type { ComponentPropsWithRef } from "react";

export type HintAttributes = Omit<ComponentPropsWithRef<"small">, "text" | "children">;

export function Hint({ text, className, style, ...attributes }: { text: string } & HintAttributes) {
  return (
    <small className={cx("hint", className)} style={style} {...attributes}>
      {text}
    </small>
  );
}
