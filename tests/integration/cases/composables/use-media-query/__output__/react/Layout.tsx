import { cx } from "./_unframework/cx";
import { scopeAttributes } from "./_unframework/scopeAttributes";
import { useMediaQuery } from "./useMediaQuery";
import type { CSSProperties } from "react";

export interface LayoutAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function Layout({ className, style, ...attributes }: LayoutAttributes) {
  const { matches: wide } = useMediaQuery("(min-width: 1px)");
  const { matches: tiny } = useMediaQuery("(max-width: 1px)");

  return (
    <section
      className={cx("layout", className)}
      aria-label="Layout"
      style={style}
      {...scopeAttributes(attributes)}
    >
      <p role="status">{wide ? "Wide layout" : "Narrow layout"}</p>
      <p>{tiny ? "Tiny screen" : "Not a tiny screen"}</p>
    </section>
  );
}
