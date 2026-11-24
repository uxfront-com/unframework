import { cx } from "./_unframework/cx";
import { scopeAttributes } from "./_unframework/scopeAttributes";
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
  ...attributes
}: SaveIndicatorProps & SaveIndicatorAttributes) {
  return (
    <p
      className={cx("save-indicator", className)}
      role="status"
      style={style}
      {...scopeAttributes(attributes)}
    >
      {saving ? <em>Saving</em> : "Saved"}, {changes === 1 ? "1 change" : `${changes} changes`}
      {savedAt ? <time dateTime={savedAt}>{" at " + savedAt}</time> : " just now"}
    </p>
  );
}
