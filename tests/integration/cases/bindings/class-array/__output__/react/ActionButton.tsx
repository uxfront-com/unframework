import type { CSSProperties } from "react";

export interface ActionButtonProps {
  label: string;
  size: "small" | "medium" | "large";
  primary: boolean;
  busy?: boolean;
  badge: number;
}

export interface ActionButtonAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function ActionButton({
  label,
  size,
  primary,
  busy = false,
  badge,
  className,
  style,
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
    >
      {label}
    </button>
  );
}

/** Joins class names, and the keys of an object's truthy entries, into one `className`. */
function cx(...parts: unknown[]): string {
  const names: string[] = [];
  for (const part of parts) {
    if (typeof part === "string") {
      if (part) names.push(part);
    } else if (part && typeof part === "object") {
      for (const [key, on] of Object.entries(part)) {
        if (on) names.push(key);
      }
    }
  }
  return names.join(" ");
}
