import { cx } from "./_unframework/cx";
import { scopeAttributes } from "./_unframework/scopeAttributes";
import type { CSSProperties, ReactNode } from "react";
import "./Frame.uf.tsx.css";

export interface FrameSlots {
  children?: ReactNode;
  renderLabel?: (props: { text: string }) => ReactNode;
}

export interface FrameAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function Frame({
  children,
  renderLabel,
  className,
  style,
  ...attributes
}: FrameSlots & FrameAttributes) {
  return (
    <figure
      className={cx("frame", className)}
      style={style}
      data-uf-9dc516fd=""
      {...scopeAttributes(attributes)}
    >
      {children}
      {renderLabel?.({ text: "Harbour at dusk" })}
    </figure>
  );
}
