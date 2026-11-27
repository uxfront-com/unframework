import { cx } from "./_unframework/cx";
import type { ComponentPropsWithRef, ReactNode } from "react";

export interface FramedNoteSlots {
  children?: ReactNode;
}

export type FramedNoteAttributes = Omit<ComponentPropsWithRef<"article">, "title" | "children">;

export default function FramedNote({
  title,
  children,
  className,
  style,
  ...attributes
}: { title: string } & FramedNoteSlots & FramedNoteAttributes) {
  return (
    <article className={cx("framed-note", className)} style={style} {...attributes}>
      <header>{children}</header>
      <p>{title}</p>
      <footer>{children}</footer>
    </article>
  );
}
