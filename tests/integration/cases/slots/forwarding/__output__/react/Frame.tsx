import Box from "./Box";
import { cx } from "./_unframework/cx";
import type { ComponentPropsWithRef, ReactNode } from "react";

export interface FrameSlots {
  title?: ReactNode;
  children?: ReactNode;
}

export type FrameAttributes = Omit<
  ComponentPropsWithRef<"section">,
  "label" | "title" | "children"
>;

export default function Frame({
  label,
  title,
  children,
  className,
  style,
  ...attributes
}: { label: string } & FrameSlots & FrameAttributes) {
  return (
    <section className={cx("frame", className)} aria-label={label} style={style} {...attributes}>
      <Box title={title}>{children}</Box>
    </section>
  );
}
