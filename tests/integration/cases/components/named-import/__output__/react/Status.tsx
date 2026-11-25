import { Badge } from "./Badge";
import { Pill as Tag } from "./Pill";
import { cx } from "./_unframework/cx";
import type { ComponentPropsWithRef } from "react";

export type StatusAttributes = Omit<ComponentPropsWithRef<"p">, "state" | "children">;

export default function Status({
  state,
  className,
  style,
  ...attributes
}: { state: string } & StatusAttributes) {
  return (
    <p className={cx("status", className)} style={style} {...attributes}>
      <Badge text="Build" />
      <Tag text={state} />
    </p>
  );
}
