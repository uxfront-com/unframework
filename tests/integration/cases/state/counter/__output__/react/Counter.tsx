import { type CSSProperties, useMemo, useRef, useState } from "react";

export interface CounterProps {
  initial?: number;
  step?: number;
}

export interface CounterEvents {
  onChange?: (value: number) => void;
}

export interface CounterAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function Counter({
  initial = 0,
  step = 1,
  onChange,
  className,
  style,
}: CounterProps & CounterEvents & CounterAttributes) {
  const [count, setCount] = useState(initial);
  const countRef = useRef(count);
  const doubled = useMemo(() => count * 2, [count]);

  function increment() {
    countRef.current += step;
    setCount(countRef.current);
    onChange?.(countRef.current);
  }

  return (
    <div className={cx("counter", className)} style={style}>
      <output>{count}</output>
      {doubled > 10 ? <span>Big</span> : null}
      <button type="button" onClick={increment}>
        +{step}
      </button>
    </div>
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
