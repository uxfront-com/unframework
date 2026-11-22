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

/** Joins class names, and the keys of an object's truthy entries, into one `className`. */
function cx(...parts: unknown[]): string {
  const names: string[] = [];
  for (const part of parts) {
    if (typeof part === "string") {
      if (part) names.push(part);
    } else if (part && typeof part === "object") {
      for (const [key, on] of Object.entries(part)) {
        if (on) names.push(key);
      }
    }
  }
  return names.join(" ");
}
