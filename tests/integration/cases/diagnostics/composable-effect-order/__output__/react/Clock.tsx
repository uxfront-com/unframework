import { cx } from "./_unframework/cx";
import { scopeAttributes } from "./_unframework/scopeAttributes";
import { useClock } from "./useClock";
import { type CSSProperties, useEffect, useEffectEvent, useRef, useState } from "react";

export interface ClockAttributes {
  className?: string;
  style?: CSSProperties;
}

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
    <p className={cx("clock", className)} style={style} {...scopeAttributes(attributes)}>
      {ready ? "Ready" : "Waiting"}, {started ? "started" : "stopped"}
    </p>
  );
}
