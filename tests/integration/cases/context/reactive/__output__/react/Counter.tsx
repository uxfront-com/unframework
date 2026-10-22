import Display from "./Display";
import { type CSSProperties, createContext, useRef, useState } from "react";

export interface CounterAttributes {
  className?: string;
  style?: CSSProperties;
}

export const CountKey = createContext<{ readonly value: number } | undefined>(undefined);

export default function Counter({ className, style, ...attributes }: CounterAttributes) {
  const [count, setCount] = useState(1);
  const countRef = useRef(count);
  const countValue = refObject(count);

  return (
    <CountKey value={countValue}>
      <section
        aria-label="Counter"
        className={className}
        style={style}
        {...scopeAttributes(attributes)}
      >
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

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const key of Object.keys(props)) {
    if (key.startsWith("data-uf-")) scope[key] = "";
  }
  return scope;
}

/** A provided ref as its consumers read it: a `value` getter over the state. */
function refObject<T>(value: T): { readonly value: T } {
  return {
    get value() {
      return value;
    },
  };
}
