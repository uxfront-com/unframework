import { cx } from "./_unframework/cx";
import type { Tone } from "./types";
import type { ComponentPropsWithRef } from "react";

export type SwatchAttributes = Omit<ComponentPropsWithRef<"span">, "tone" | "children">;

export default function Swatch({
  tone,
  className,
  style,
  ...attributes
}: { tone: Tone } & SwatchAttributes) {
  return (
    <span className={cx(`swatch swatch-${tone}`, className)} style={style} {...attributes}>
      {tone}
    </span>
  );
}
