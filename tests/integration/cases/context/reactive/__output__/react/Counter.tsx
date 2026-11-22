import Display from "./Display";
import { type ComponentPropsWithRef, createContext, useRef, useState } from "react";

export type CounterAttributes = Omit<ComponentPropsWithRef<"section">, "children">;

export const CountKey = createContext<{ readonly value: number } | undefined>(undefined);

export default function Counter({ className, style, ...attributes }: CounterAttributes) {
  const [count, setCount] = useState(1);
  const countRef = useRef(count);
  const countValue = refObject(count);

  return (
    <CountKey value={countValue}>
      <section aria-label="Counter" className={className} style={style} {...attributes}>
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

/** A provided ref as its consumers read it: a `value` getter over the state. */
function refObject<T>(value: T): { readonly value: T } {
  return {
    get value() {
      return value;
    },
  };
}
