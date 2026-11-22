import { cx } from "./_unframework/cx";
import { scopeAttributes } from "./_unframework/scopeAttributes";
import type { Tone } from "./types";
import type { CSSProperties } from "react";

export interface SwatchAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function Swatch({
  tone,
  className,
  style,
  ...attributes
}: { tone: Tone } & SwatchAttributes) {
  return (
    <span
      className={cx(`swatch swatch-${tone}`, className)}
      style={style}
      {...scopeAttributes(attributes)}
    >
      {tone}
    </span>
  );
}
