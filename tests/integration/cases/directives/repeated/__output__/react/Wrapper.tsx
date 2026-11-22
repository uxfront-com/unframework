import Rows from "./Rows";
import { cx } from "./_unframework/cx";
import { scopeAttributes } from "./_unframework/scopeAttributes";
import type { CSSProperties, ReactNode } from "react";

export interface WrapperSlots {
  row?: ReactNode;
}

export interface WrapperAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function Wrapper({
  row,
  className,
  style,
  ...attributes
}: WrapperSlots & WrapperAttributes) {
  return (
    <section
      className={cx("wrapper", className)}
      aria-label="Rows"
      style={style}
      {...scopeAttributes(attributes)}
    >
      <Rows row={row} />
    </section>
  );
}
