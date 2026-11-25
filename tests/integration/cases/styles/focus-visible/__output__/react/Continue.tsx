import { cx } from "./_unframework/cx";
import type { ComponentPropsWithRef } from "react";
import "./Continue.uf.tsx.css";

export type ContinueAttributes = Omit<ComponentPropsWithRef<"button">, "text" | "children">;

export default function Continue({
  text,
  className,
  style,
  ...attributes
}: { text: string } & ContinueAttributes) {
  return (
    <button
      type="button"
      className={cx("continue", className)}
      style={style}
      data-uf-bb3adc28=""
      {...attributes}
    >
      {text}
    </button>
  );
}
