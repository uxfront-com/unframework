import Base from "./Base";
import { cx } from "./_unframework/cx";
import type { ComponentPropsWithoutRef, Ref } from "react";

export interface PrimaryEvents {
  onPress?: () => void;
}

export type PrimaryAttributes = Omit<
  ComponentPropsWithoutRef<typeof Base>,
  "href" | "disabled" | "text" | "onPress" | "children"
> & { ref?: Ref<HTMLAnchorElement | HTMLButtonElement> };

export default function Primary({
  href,
  disabled,
  text,
  onPress,
  className,
  style,
  ...attributes
}: { href?: string; disabled?: boolean; text: string } & PrimaryEvents & PrimaryAttributes) {
  return (
    <Base
      href={href}
      disabled={disabled}
      text={text}
      className={cx("primary", className)}
      onPress={() => onPress?.()}
      style={style}
      {...attributes}
    />
  );
}
