import Card from "./Card";
import Panel from "./Panel";
import { cx } from "./_unframework/cx";
import { scopeAttributes } from "./_unframework/scopeAttributes";
import type { CSSProperties, ReactNode } from "react";

export interface FrameSlots {
  title?: ReactNode;
}

export interface FrameAttributes {
  className?: string;
  style?: CSSProperties;
}

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
    <section
      className={cx("frame", className)}
      aria-label={label}
      style={style}
      {...scopeAttributes(attributes)}
    >
      <Tag title={title} />
    </section>
  );
}
