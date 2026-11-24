import { cx } from "./_unframework/cx";
import {
  type ComponentPropsWithoutRef,
  type Ref,
  useImperativeHandle,
  useRef,
  useState,
} from "react";

export interface CounterHandle {
  increment(): void;
  reset(): void;
}

export type CounterAttributes = Omit<ComponentPropsWithoutRef<"output">, "start" | "children"> & {
  ref?: Ref<CounterHandle>;
};

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
    <output className={cx("count", className)} style={style} {...attributes}>
      {count}
    </output>
  );
}
