import { cx } from "./_unframework/cx";
import type { ComponentPropsWithRef } from "react";

export type Tone = "info" | "warning";

export type TagAttributes = Omit<ComponentPropsWithRef<"span">, "tone" | "children">;

export default function Tag({
  tone,
  className,
  style,
  ...attributes
}: { tone: Tone } & TagAttributes) {
  return (
    <span className={cx("tag", tone, className)} style={style} {...attributes}>
      {tone}
    </span>
  );
}
