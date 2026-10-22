import { CountKey } from "./Counter";
import { type CSSProperties, use, useState } from "react";

export interface DisplayAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function Display({ className, style, ...attributes }: DisplayAttributes) {
  const [none] = useState(0);
  const count = use(CountKey) ?? refObject(none);

  return (
    <output className={className} style={style} {...scopeAttributes(attributes)}>
      Count: {count.value}
    </output>
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
