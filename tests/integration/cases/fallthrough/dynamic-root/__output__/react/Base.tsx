import { cx } from "./_unframework/cx";
import { scopeAttributes } from "./_unframework/scopeAttributes";
import type { CSSProperties, MouseEvent } from "react";

export interface BaseEvents {
  onPress?: () => void;
}

export interface BaseAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function Base({
  href,
  disabled,
  text,
  onPress,
  className,
  style,
  ...attributes
}: { href?: string; disabled?: boolean; text: string } & BaseEvents & BaseAttributes) {
  function press(event: MouseEvent) {
    event.preventDefault();
    onPress?.();
  }

  const Tag = href ? "a" : "button";

  return (
    <Tag
      href={Tag === "a" ? href : undefined}
      disabled={Tag === "button" ? disabled : undefined}
      className={cx("base", className)}
      style={{ padding: "4px 8px", ...style }}
      onClick={press}
      {...scopeAttributes(attributes)}
    >
      {text}
    </Tag>
  );
}
