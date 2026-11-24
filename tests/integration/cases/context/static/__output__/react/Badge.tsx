import { ThemeKey } from "./ThemeProvider";
import { cx } from "./_unframework/cx";
import { type ComponentPropsWithRef, use } from "react";

export type BadgeAttributes = Omit<ComponentPropsWithRef<"span">, "text" | "children">;

export default function Badge({
  text,
  className,
  style,
  ...attributes
}: { text: string } & BadgeAttributes) {
  const theme = use(ThemeKey);

  return (
    <span className={cx("badge", theme?.accent, className)} style={style} {...attributes}>
      {text} in {theme?.label ?? "no theme"}
    </span>
  );
}
