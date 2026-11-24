import { cx } from "./_unframework/cx";
import { scopeAttributes } from "./_unframework/scopeAttributes";
import type { CSSProperties } from "react";

export interface NoticeAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function Notice({
  text,
  tone,
  className,
  style,
  ...attributes
}: { text: string; tone: "info" | "quiet" } & NoticeAttributes) {
  return (
    <p
      role="status"
      className={cx("notice", tone, className)}
      style={style}
      {...scopeAttributes(attributes)}
    >
      {text}
    </p>
  );
}
