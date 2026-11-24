import Base from "./Base";
import { cx } from "./_unframework/cx";
import { scopeAttributes } from "./_unframework/scopeAttributes";
import type { CSSProperties } from "react";

export interface PrimaryEvents {
  onPress?: () => void;
}

export interface PrimaryAttributes {
  className?: string;
  style?: CSSProperties;
}

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
      {...scopeAttributes(attributes)}
    />
  );
}
