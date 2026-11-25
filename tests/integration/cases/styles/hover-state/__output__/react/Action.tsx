import { cx } from "./_unframework/cx";
import type { ComponentPropsWithRef } from "react";
import "./Action.uf.tsx.css";

export type ActionAttributes = Omit<ComponentPropsWithRef<"button">, "text" | "children">;

export default function Action({
  text,
  className,
  style,
  ...attributes
}: { text: string } & ActionAttributes) {
  return (
    <button
      type="button"
      className={cx("action", className)}
      style={style}
      data-uf-6173c12c=""
      {...attributes}
    >
      {text}
    </button>
  );
}
