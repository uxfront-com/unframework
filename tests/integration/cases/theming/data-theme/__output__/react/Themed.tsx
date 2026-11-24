import { cx } from "./_unframework/cx";
import type { ComponentPropsWithRef } from "react";
import "virtual:styleframe.css";

export type ThemedAttributes = Omit<ComponentPropsWithRef<"section">, "text" | "dark" | "children">;

export default function Themed({
  text,
  dark = false,
  className,
  style,
  ...attributes
}: { text: string; dark?: boolean } & ThemedAttributes) {
  return (
    <section
      data-theme={dark ? "dark" : "light"}
      className={cx("_padding:md _background-color:surface _color:text", className)}
      style={style}
      {...attributes}
    >
      {text}
    </section>
  );
}
