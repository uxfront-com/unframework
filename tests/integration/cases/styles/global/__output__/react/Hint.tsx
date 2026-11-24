import { cx } from "./_unframework/cx";
import type { ComponentPropsWithRef } from "react";

export type HintAttributes = Omit<ComponentPropsWithRef<"p">, "text" | "children">;

export default function Hint({
  text,
  className,
  style,
  ...attributes
}: { text: string } & HintAttributes) {
  return (
    <p className={cx("hint", className)} style={style} {...attributes}>
      Tip: <span className="uf-highlight">{text}</span>
    </p>
  );
}
