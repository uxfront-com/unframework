import Badge from "./Badge";
import Tag from "./Tag";
import { cx } from "./_unframework/cx";
import { scopeAttributes } from "./_unframework/scopeAttributes";
import type { CSSProperties } from "react";

export interface LabelsAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function Labels({ className, style, ...attributes }: LabelsAttributes) {
  return (
    <section
      className={cx("labels", className)}
      aria-label="Labels"
      style={style}
      {...scopeAttributes(attributes)}
    >
      <Badge label="New" />
      <Tag name="docs" />
    </section>
  );
}
