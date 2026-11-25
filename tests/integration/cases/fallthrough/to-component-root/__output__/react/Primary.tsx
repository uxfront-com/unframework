import Base from "./Base";
import { cx } from "./_unframework/cx";
import type { ComponentPropsWithRef } from "react";

export type PrimaryAttributes = Omit<ComponentPropsWithRef<typeof Base>, "text" | "children">;

export default function Primary({
  text,
  className,
  style,
  ...attributes
}: { text: string } & PrimaryAttributes) {
  return <Base text={text} className={cx("primary", className)} style={style} {...attributes} />;
}
