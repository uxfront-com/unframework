import { cx } from "./_unframework/cx";
import { scopeAttributes } from "./_unframework/scopeAttributes";
import type { CSSProperties } from "react";
import "./Badge.uf.tsx.css";

export interface BadgeAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function Badge({
  label,
  count,
  className,
  style,
  ...attributes
}: { label: string; count: number } & BadgeAttributes) {
  return (
    <span
      className={cx("badge", className)}
      style={style}
      data-uf-d9cef2e7=""
      {...scopeAttributes(attributes)}
    >
      <span className="label" data-uf-d9cef2e7="">
        {label}
      </span>
      <span className="count" data-uf-d9cef2e7="">
        {count}
      </span>
    </span>
  );
}
