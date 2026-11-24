import { cx } from "./_unframework/cx";
import type { ComponentPropsWithRef, ReactNode } from "react";

export interface NoticeSlots {
  children?: ReactNode;
  action?: ReactNode;
}

export type NoticeAttributes = Omit<ComponentPropsWithRef<"div">, "label" | "children" | "action">;

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
      {...attributes}
    >
      <p>{children ?? <em>Nothing to report.</em>}</p>
      {action ?? <span className="muted">No action</span>}
    </div>
  );
}
