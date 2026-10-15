import type { CSSProperties } from "react";

export interface SaveIndicatorProps {
  saving: boolean;
  changes: number;
  savedAt?: string;
}

export interface SaveIndicatorAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function SaveIndicator({
  saving,
  changes,
  savedAt,
  className,
  style,
}: SaveIndicatorProps & SaveIndicatorAttributes) {
  return (
    <p className={cx("save-indicator", className)} role="status" style={style}>
      {saving ? <em>Saving</em> : "Saved"}, {changes === 1 ? "1 change" : `${changes} changes`}
      {savedAt ? <time dateTime={savedAt}>{" at " + savedAt}</time> : " just now"}
    </p>
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
