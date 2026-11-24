import { cx } from "./_unframework/cx";
import type { ComponentPropsWithRef } from "react";

export type CountdownAttributes = Omit<ComponentPropsWithRef<"div">, "from" | "children">;

export default function Countdown({
  from,
  className,
  style,
  ...attributes
}: { from: number } & CountdownAttributes) {
  return (
    <div className={cx("level", className)} style={style} {...attributes}>
      <span>{from}</span>
      {from > 0 ? <Countdown from={from - 1} /> : <strong>Liftoff</strong>}
    </div>
  );
}
