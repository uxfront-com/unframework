import { cx } from "./_unframework/cx";
import { scopeAttributes } from "./_unframework/scopeAttributes";
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
  ...attributes
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
    <output className={cx("count", className)} style={style} {...scopeAttributes(attributes)}>
      {count}
    </output>
  );
}
