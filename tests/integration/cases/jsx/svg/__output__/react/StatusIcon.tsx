import type { CSSProperties } from "react";

export interface StatusIconProps {
  label: string;
  size?: number;
  colour?: string;
}

export interface StatusIconAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function StatusIcon({
  label,
  size = 24,
  colour = "#1f6feb",
  className,
  style,
  ...attributes
}: StatusIconProps & StatusIconAttributes) {
  return (
    <svg
      className={cx("status-icon", className)}
      role="img"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      style={style}
      {...scopeAttributes(attributes)}
    >
      <title>{label}</title>
      <defs>
        <linearGradient id="status-icon-fill" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={colour} />
          <stop offset="1" stopColor="#0b3d91" />
        </linearGradient>
      </defs>
      <circle cx="12" cy="12" r="10" fill="url(#status-icon-fill)" />
      <path
        d="M7 12.5l3 3 7-7"
        stroke="#ffffff"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
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

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const key of Object.keys(props)) {
    if (key.startsWith("data-uf-")) scope[key] = "";
  }
  return scope;
}
