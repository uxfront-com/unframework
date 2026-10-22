import type { CSSProperties, ReactNode } from "react";

export interface NoticeSlots {
  children?: ReactNode;
  action?: ReactNode;
}

export interface NoticeAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function Notice({
  label,
  children,
  action,
  className,
  style,
  ...attributes
}: { label: string } & NoticeSlots & NoticeAttributes) {
  return (
    <div
      role="note"
      aria-label={label}
      className={cx("notice", className)}
      style={style}
      {...scopeAttributes(attributes)}
    >
      <p>{children ?? <em>Nothing to report.</em>}</p>
      {action ?? <span className="muted">No action</span>}
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
