import Base from "./Base";
import { cx } from "./_unframework/cx";
import type { ComponentPropsWithoutRef, Ref } from "react";

export type PrimaryAttributes = Omit<
  ComponentPropsWithoutRef<typeof Base>,
  "href" | "text" | "children"
> & { ref?: Ref<HTMLAnchorElement | HTMLButtonElement> };

export default function Primary({
  href,
  text,
  className,
  style,
  ...attributes
}: { href?: string; text: string } & PrimaryAttributes) {
  return (
    <Base
      href={href}
      text={text}
      className={cx("primary", className)}
      style={style}
      {...attributes}
    />
  );
}
