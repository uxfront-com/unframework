import { cx } from "./_unframework/cx";
import { scopeAttributes } from "./_unframework/scopeAttributes";
import type { CSSProperties } from "react";

export interface StatusPillProps {
  status: "active" | "paused" | "archived";
  size?: "small" | "large";
  level?: 1 | 2 | 3;
}

export interface StatusPillAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function StatusPill({
  status,
  size = "small",
  level = 1,
  className,
  style,
  ...attributes
}: StatusPillProps & StatusPillAttributes) {
  return (
    <span
      className={cx("pill", `pill-${status}`, `pill-${size}`, `pill-level-${level}`, className)}
      style={style}
      {...scopeAttributes(attributes)}
    >
      {status === "active" ? "Active" : status === "paused" ? "Paused" : "Archived"}
      {level === 3 ? " (critical)" : ""}
    </span>
  );
}
