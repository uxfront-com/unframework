import { cx } from "./_unframework/cx";
import { scopeAttributes } from "./_unframework/scopeAttributes";
import type { CSSProperties } from "react";

export interface BannerProps {
  message: string;
  tone: string;
  emphasis?: string | null;
}

export interface BannerAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function Banner({
  message,
  tone,
  emphasis,
  className,
  style,
  ...attributes
}: BannerProps & BannerAttributes) {
  return (
    <div
      className={cx("banner", tone, className)}
      role="note"
      style={style}
      {...scopeAttributes(attributes)}
    >
      <p className={cx(emphasis)}>{message}</p>
      <p className={cx(`banner-footer banner-footer-${tone}`)}>Shown to every visitor.</p>
    </div>
  );
}
