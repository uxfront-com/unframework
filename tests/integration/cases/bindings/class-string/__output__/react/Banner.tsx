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
