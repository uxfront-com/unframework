import Swatch from "./Swatch";
import { cx } from "./_unframework/cx";
import { scopeAttributes } from "./_unframework/scopeAttributes";
import type { Tone } from "./types";
import type { CSSProperties } from "react";

export type { Tone } from "./types";

export interface PaletteAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function Palette({
  tone,
  className,
  style,
  ...attributes
}: { tone: Tone } & PaletteAttributes) {
  return (
    <div className={cx("palette", className)} style={style} {...scopeAttributes(attributes)}>
      <Swatch tone={tone} />
    </div>
  );
}
