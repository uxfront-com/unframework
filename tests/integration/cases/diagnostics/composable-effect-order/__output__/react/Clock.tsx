import { cx } from "./_unframework/cx";
import { useClock } from "./useClock";
import { type ComponentPropsWithRef, useEffect, useEffectEvent, useRef, useState } from "react";

export type ClockAttributes = Omit<ComponentPropsWithRef<"p">, "children">;

export default function Clock({ className, style, ...attributes }: ClockAttributes) {
  const [ready, setReady] = useState(false);
  const readyRef = useRef(ready);

  const onMount = useEffectEvent(() => {
    readyRef.current = true;
    setReady(readyRef.current);
  });
  useEffect(() => {
    onMount();
  }, []);

  const { started } = useClock();

  return (
    <p className={cx("clock", className)} style={style} {...attributes}>
      {ready ? "Ready" : "Waiting"}, {started ? "started" : "stopped"}
    </p>
  );
}
