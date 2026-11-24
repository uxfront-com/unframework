import { cx } from "./_unframework/cx";
import { scopeAttributes } from "./_unframework/scopeAttributes";
import { useDirective } from "./_unframework/useDirective";
import { vMark } from "./vMark";
import type { CSSProperties } from "react";

export interface BadgeProps {
  label: string;
}

export interface BadgeAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function Badge({
  label,
  className,
  style,
  ...attributes
}: BadgeProps & BadgeAttributes) {
  const markRef = useDirective(vMark, () => "badge");

  return (
    <span
      className={cx("badge", className)}
      ref={markRef}
      style={style}
      {...scopeAttributes(attributes)}
    >
      {label}
    </span>
  );
}
