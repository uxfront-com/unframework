import { cx } from "./_unframework/cx";
import type { ComponentPropsWithRef } from "react";

export type NoteAttributes = Omit<ComponentPropsWithRef<"div">, "text" | "children">;

export default function Note({
  text,
  className,
  style,
  ...attributes
}: { text: string } & NoteAttributes) {
  return (
    <div className={cx("note-box", className)} style={style} {...attributes}>
      <p className="note">{text}</p>
    </div>
  );
}
