import { cx } from "./_unframework/cx";
import type { ComponentPropsWithRef } from "react";

export type HeaderAttributes = Omit<ComponentPropsWithRef<"header">, "children">;

export function Header({ className, style, ...attributes }: HeaderAttributes) {
  return (
    <header className={cx("header", className)} style={style} {...attributes}>
      Site
    </header>
  );
}
