import { type CSSProperties, type Ref, useImperativeHandle, useRef, useState } from "react";

export interface CounterHandle {
  increment(): void;
  reset(): void;
}

export interface CounterAttributes {
  className?: string;
  style?: CSSProperties;
  ref?: Ref<CounterHandle>;
}

export default function Counter({
  start,
  className,
  style,
  ref,
}: { start: number } & CounterAttributes) {
  const [count, setCount] = useState(start);
  const countRef = useRef(count);

  function increment() {
    countRef.current++;
    setCount(countRef.current);
  }

  const reset = () => {
    countRef.current = start;
    setCount(countRef.current);
  };

  useImperativeHandle(ref, () => ({ increment, reset }));

  return (
    <output className={cx("count", className)} style={style}>
      {count}
    </output>
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
