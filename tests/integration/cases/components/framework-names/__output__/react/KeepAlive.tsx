import { cx } from "./_unframework/cx";
import type { ComponentPropsWithRef } from "react";

export type KeepAliveAttributes = Omit<ComponentPropsWithRef<"div">, "level" | "children">;

export default function KeepAlive({
  level,
  className,
  style,
  ...attributes
}: { level: number } & KeepAliveAttributes) {
  return (
    <div className={cx("level", className)} style={style} {...attributes}>
      <span>Level {level}</span>
      {level > 0 ? <KeepAlive level={level - 1} /> : null}
    </div>
  );
}
