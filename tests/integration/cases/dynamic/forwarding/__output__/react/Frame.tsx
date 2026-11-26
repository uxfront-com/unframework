import Card from "./Card";
import Panel from "./Panel";
import { cx } from "./_unframework/cx";
import type { ComponentPropsWithRef, ReactNode } from "react";

export interface FrameSlots {
  title?: ReactNode;
}

export type FrameAttributes = Omit<
  ComponentPropsWithRef<"section">,
  "label" | "wide" | "title" | "children"
>;

export default function Frame({
  label,
  wide,
  title,
  className,
  style,
  ...attributes
}: { label: string; wide: boolean } & FrameSlots & FrameAttributes) {
  const Tag = wide ? Panel : Card;

  return (
    <section className={cx("frame", className)} aria-label={label} style={style} {...attributes}>
      <Tag title={title} />
    </section>
  );
}
