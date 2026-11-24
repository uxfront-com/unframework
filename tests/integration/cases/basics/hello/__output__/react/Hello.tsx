import { cx } from "./_unframework/cx";
import type { ComponentPropsWithRef } from "react";

export type HelloAttributes = Omit<ComponentPropsWithRef<"p">, "children">;

export default function Hello({ className, style, ...attributes }: HelloAttributes) {
  return (
    <p className={cx("greeting", className)} style={style} {...attributes}>
      Hello, world!
    </p>
  );
}
