import Rows from "./Rows";
import { cx } from "./_unframework/cx";
import type { ComponentPropsWithRef, ReactNode } from "react";

export interface WrapperSlots {
  row?: ReactNode;
}

export type WrapperAttributes = Omit<ComponentPropsWithRef<"section">, "row" | "children">;

export default function Wrapper({
  row,
  className,
  style,
  ...attributes
}: WrapperSlots & WrapperAttributes) {
  return (
    <section className={cx("wrapper", className)} aria-label="Rows" style={style} {...attributes}>
      <Rows row={row} />
    </section>
  );
}
