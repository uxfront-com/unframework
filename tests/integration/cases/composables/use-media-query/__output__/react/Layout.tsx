import { cx } from "./_unframework/cx";
import { useMediaQuery } from "./useMediaQuery";
import type { ComponentPropsWithRef } from "react";

export type LayoutAttributes = Omit<ComponentPropsWithRef<"section">, "children">;

export default function Layout({ className, style, ...attributes }: LayoutAttributes) {
  const { matches: wide } = useMediaQuery("(min-width: 1px)");
  const { matches: tiny } = useMediaQuery("(max-width: 1px)");

  return (
    <section className={cx("layout", className)} aria-label="Layout" style={style} {...attributes}>
      <p role="status">{wide ? "Wide layout" : "Narrow layout"}</p>
      <p>{tiny ? "Tiny screen" : "Not a tiny screen"}</p>
    </section>
  );
}
