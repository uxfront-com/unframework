import Badge from "./Badge";
import Tag from "./Tag";
import { cx } from "./_unframework/cx";
import type { ComponentPropsWithRef } from "react";

export type LabelsAttributes = Omit<ComponentPropsWithRef<"section">, "children">;

export default function Labels({ className, style, ...attributes }: LabelsAttributes) {
  return (
    <section className={cx("labels", className)} aria-label="Labels" style={style} {...attributes}>
      <Badge label="New" />
      <Tag name="docs" />
    </section>
  );
}
