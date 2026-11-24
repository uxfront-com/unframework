import { cx } from "./_unframework/cx";
import type { ComponentPropsWithRef } from "react";

export type NoticeAttributes = Omit<ComponentPropsWithRef<"p">, "text" | "tone" | "children">;

export default function Notice({
  text,
  tone,
  className,
  style,
  ...attributes
}: { text: string; tone: "info" | "quiet" } & NoticeAttributes) {
  return (
    <p role="status" className={cx("notice", tone, className)} style={style} {...attributes}>
      {text}
    </p>
  );
}
