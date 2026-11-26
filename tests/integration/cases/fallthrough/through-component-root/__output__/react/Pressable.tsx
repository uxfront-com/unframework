import { cx } from "./_unframework/cx";
import type { ComponentPropsWithRef } from "react";

export type PressableAttributes = Omit<ComponentPropsWithRef<"button">, "text" | "children">;

export default function Pressable({
  text,
  className,
  style,
  ...attributes
}: { text: string } & PressableAttributes) {
  return (
    <button type="button" className={cx("pressable", className)} style={style} {...attributes}>
      {text}
    </button>
  );
}
