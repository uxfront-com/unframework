import { cx } from "./_unframework/cx";
import type { ComponentPropsWithRef } from "react";
import "./Badge.uf.tsx.css";

export type BadgeAttributes = Omit<ComponentPropsWithRef<"span">, "label" | "count" | "children">;

export default function Badge({
  label,
  count,
  className,
  style,
  ...attributes
}: { label: string; count: number } & BadgeAttributes) {
  return (
    <span className={cx("badge", className)} style={style} data-uf-d9cef2e7="" {...attributes}>
      <span className="label" data-uf-d9cef2e7="">
        {label}
      </span>
      <span className="count" data-uf-d9cef2e7="">
        {count}
      </span>
    </span>
  );
}
