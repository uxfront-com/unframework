import { ThemeKey } from "./ThemeProvider";
import { cx } from "./_unframework/cx";
import { scopeAttributes } from "./_unframework/scopeAttributes";
import { type CSSProperties, use } from "react";

export interface BadgeAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function Badge({
  text,
  className,
  style,
  ...attributes
}: { text: string } & BadgeAttributes) {
  const theme = use(ThemeKey);

  return (
    <span
      className={cx("badge", theme?.accent, className)}
      style={style}
      {...scopeAttributes(attributes)}
    >
      {text} in {theme?.label ?? "no theme"}
    </span>
  );
}
