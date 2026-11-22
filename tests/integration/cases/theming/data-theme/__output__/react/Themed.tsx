import { cx } from "./_unframework/cx";
import { scopeAttributes } from "./_unframework/scopeAttributes";
import type { CSSProperties } from "react";
import "virtual:styleframe.css";

export interface ThemedAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function Themed({
  text,
  dark = false,
  className,
  style,
  ...attributes
}: { text: string; dark?: boolean } & ThemedAttributes) {
  return (
    <section
      data-theme={dark ? "dark" : "light"}
      className={cx("_padding:md _background-color:surface _color:text", className)}
      style={style}
      {...scopeAttributes(attributes)}
    >
      {text}
    </section>
  );
}
