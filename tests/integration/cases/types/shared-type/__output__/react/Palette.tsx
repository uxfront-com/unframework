import Swatch from "./Swatch";
import { cx } from "./_unframework/cx";
import type { Tone } from "./types";
import type { ComponentPropsWithRef } from "react";

export type { Tone } from "./types";

export type PaletteAttributes = Omit<ComponentPropsWithRef<"div">, "tone" | "children">;

export default function Palette({
  tone,
  className,
  style,
  ...attributes
}: { tone: Tone } & PaletteAttributes) {
  return (
    <div className={cx("palette", className)} style={style} {...attributes}>
      <Swatch tone={tone} />
    </div>
  );
}
