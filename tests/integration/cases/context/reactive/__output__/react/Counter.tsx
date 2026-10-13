import Display from "./Display";
import { type CSSProperties, createContext, useRef, useState } from "react";

export interface CounterAttributes {
  className?: string;
  style?: CSSProperties;
}

export const CountKey = createContext<{ readonly value: number } | undefined>(undefined);

export default function Counter({ className, style }: CounterAttributes) {
  const [count, setCount] = useState(1);
  const countRef = useRef(count);
  const countValue = refObject(count);

  return (
    <CountKey value={countValue}>
      <section aria-label="Counter" className={className} style={style}>
        <Display />
        <button
          type="button"
          onClick={() => {
            countRef.current += 1;
            setCount(countRef.current);
          }}
        >
          Add one
        </button>
      </section>
    </CountKey>
  );
}

/** A provided ref's value, as its consumers read it: `{ value }`. */
function refObject<T>(value: T): { readonly value: T } {
  return { value };
}
