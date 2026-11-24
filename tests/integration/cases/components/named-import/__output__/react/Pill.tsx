import { cx } from "./_unframework/cx";
import type { ComponentPropsWithRef } from "react";

export type PillAttributes = Omit<ComponentPropsWithRef<"span">, "text" | "children">;

export function Pill({ text, className, style, ...attributes }: { text: string } & PillAttributes) {
  return (
    <span className={cx("pill", className)} style={style} {...attributes}>
      {text}
    </span>
  );
}
