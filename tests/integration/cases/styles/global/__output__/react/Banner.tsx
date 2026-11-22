import Hint from "./Hint";
import type { ComponentPropsWithRef } from "react";
import "./Banner.uf.tsx.css";

export type BannerAttributes = Omit<ComponentPropsWithRef<"div">, "tip" | "children">;

export default function Banner({
  tip,
  className,
  style,
  ...attributes
}: { tip: string } & BannerAttributes) {
  return (
    <div className={cx("banner", className)} style={style} data-uf-e25060c2="" {...attributes}>
      <Hint text={tip} data-uf-e25060c2="" />
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
