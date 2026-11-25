import { cx } from "./_unframework/cx";
import type { ComponentPropsWithRef } from "react";

export interface ActionButtonProps {
  label: string;
  size: "small" | "medium" | "large";
  primary: boolean;
  busy?: boolean;
  badge: number;
}

export type ActionButtonAttributes = Omit<
  ComponentPropsWithRef<"button">,
  "label" | "size" | "primary" | "busy" | "badge" | "children"
>;

export default function ActionButton({
  label,
  size,
  primary,
  busy = false,
  badge,
  className,
  style,
  ...attributes
}: ActionButtonProps & ActionButtonAttributes) {
  return (
    <button
      type="button"
      className={cx(
        "button",
        `button-${size}`,
        { "button-primary": primary, "is-busy": busy, "button-waiting": busy, "has-badge": badge },
        primary ? "solid" : "outline",
        className,
      )}
      style={style}
      {...attributes}
    >
      {label}
    </button>
  );
}
