import { cx } from "./_unframework/cx";
import { useTeardown } from "./useTeardown";
import type { ComponentPropsWithRef } from "react";

export interface PanelEvents {
  onClosed?: (entry: string) => void;
}

export type PanelAttributes = Omit<
  ComponentPropsWithRef<"section">,
  "name" | "onClosed" | "children"
>;

export default function Panel({
  name,
  onClosed,
  className,
  style,
  ...attributes
}: { name: string } & PanelEvents & PanelAttributes) {
  const { title } = useTeardown(
    () => name,
    (entry) => onClosed?.(entry),
  );

  return (
    <section className={cx("panel", className)} aria-label={title} style={style} {...attributes}>
      <h2>{title}</h2>
    </section>
  );
}
