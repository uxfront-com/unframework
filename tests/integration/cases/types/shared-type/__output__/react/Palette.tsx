import Swatch from "./Swatch";
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

/** Joins class names, and the keys of an object's truthy entries, into one `className`. */
function cx(...parts: unknown[]): string {
  const names: string[] = [];
  for (const part of parts) {
    if (typeof part === "string") {
      if (part) names.push(part);
    } else if (part && typeof part === "object") {
      for (const [key, on] of Object.entries(part)) {
        if (on) names.push(key);
      }
    }
  }
  return names.join(" ");
}
