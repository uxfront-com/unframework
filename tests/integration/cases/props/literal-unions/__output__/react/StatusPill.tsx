import { cx } from "./_unframework/cx";
import type { ComponentPropsWithRef } from "react";

export interface StatusPillProps {
  status: "active" | "paused" | "archived";
  size?: "small" | "large";
  level?: 1 | 2 | 3;
}

export type StatusPillAttributes = Omit<
  ComponentPropsWithRef<"span">,
  "status" | "size" | "level" | "children"
>;

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
      {...attributes}
    >
      {status === "active" ? "Active" : status === "paused" ? "Paused" : "Archived"}
      {level === 3 ? " (critical)" : ""}
    </span>
  );
}
