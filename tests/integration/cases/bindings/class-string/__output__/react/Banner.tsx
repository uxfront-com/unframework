import { cx } from "./_unframework/cx";
import type { ComponentPropsWithRef } from "react";

export interface BannerProps {
  message: string;
  tone: string;
  emphasis?: string | null;
}

export type BannerAttributes = Omit<
  ComponentPropsWithRef<"div">,
  "message" | "tone" | "emphasis" | "children"
>;

export default function Banner({
  message,
  tone,
  emphasis,
  className,
  style,
  ...attributes
}: BannerProps & BannerAttributes) {
  return (
    <div className={cx("banner", tone, className)} role="note" style={style} {...attributes}>
      <p className={cx(emphasis)}>{message}</p>
      <p className={cx(`banner-footer banner-footer-${tone}`)}>Shown to every visitor.</p>
    </div>
  );
}
