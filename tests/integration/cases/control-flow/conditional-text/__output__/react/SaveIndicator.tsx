import { cx } from "./_unframework/cx";
import type { ComponentPropsWithRef } from "react";

export interface SaveIndicatorProps {
  saving: boolean;
  changes: number;
  savedAt?: string;
}

export type SaveIndicatorAttributes = Omit<
  ComponentPropsWithRef<"p">,
  "saving" | "changes" | "savedAt" | "children"
>;

export default function SaveIndicator({
  saving,
  changes,
  savedAt,
  className,
  style,
  ...attributes
}: SaveIndicatorProps & SaveIndicatorAttributes) {
  return (
    <p className={cx("save-indicator", className)} role="status" style={style} {...attributes}>
      {saving ? <em>Saving</em> : "Saved"}, {changes === 1 ? "1 change" : `${changes} changes`}
      {savedAt ? <time dateTime={savedAt}>{" at " + savedAt}</time> : " just now"}
    </p>
  );
}
