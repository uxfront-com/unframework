import { CountKey } from "./Counter";
import { type CSSProperties, use, useState } from "react";

export interface DisplayAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function Display({ className, style }: DisplayAttributes) {
  const [none] = useState(0);
  const count = use(CountKey) ?? refObject(none);

  return (
    <output className={className} style={style}>
      Count: {count.value}
    </output>
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
