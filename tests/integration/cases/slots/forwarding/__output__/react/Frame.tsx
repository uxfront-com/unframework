import Box from "./Box";
import { cx } from "./_unframework/cx";
import { scopeAttributes } from "./_unframework/scopeAttributes";
import type { CSSProperties, ReactNode } from "react";

export interface FrameSlots {
  title?: ReactNode;
  children?: ReactNode;
}

export interface FrameAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function Frame({
  label,
  title,
  children,
  className,
  style,
  ...attributes
}: { label: string } & FrameSlots & FrameAttributes) {
  return (
    <section
      className={cx("frame", className)}
      aria-label={label}
      style={style}
      {...scopeAttributes(attributes)}
    >
      <Box title={title}>{children}</Box>
    </section>
  );
}
