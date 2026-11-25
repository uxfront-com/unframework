import { cx } from "./_unframework/cx";
import type { ComponentPropsWithRef } from "react";
import "virtual:styleframe.css";

export type NoteAttributes = Omit<ComponentPropsWithRef<"p">, "text" | "children">;

export default function Note({
  text,
  className,
  style,
  ...attributes
}: { text: string } & NoteAttributes) {
  return (
    <p
      className={cx("_padding:md _background-color:surface _color:text", className)}
      style={style}
      {...attributes}
    >
      {text}
    </p>
  );
}
