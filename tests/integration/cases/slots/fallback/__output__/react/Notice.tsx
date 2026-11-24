import { cx } from "./_unframework/cx";
import { scopeAttributes } from "./_unframework/scopeAttributes";
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
