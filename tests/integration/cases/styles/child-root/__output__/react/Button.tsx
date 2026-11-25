import { cx } from "./_unframework/cx";
import type { ComponentPropsWithRef } from "react";

export type ButtonAttributes = Omit<ComponentPropsWithRef<"button">, "text" | "children">;

export default function Button({
  text,
  className,
  style,
  ...attributes
}: { text: string } & ButtonAttributes) {
  return (
    <button type="button" className={cx("button", className)} style={style} {...attributes}>
      <span className="icon" aria-hidden="true">
        +
      </span>
      {text}
    </button>
  );
}
