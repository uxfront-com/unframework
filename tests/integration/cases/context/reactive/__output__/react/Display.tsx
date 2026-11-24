import { CountKey } from "./Counter";
import { type ComponentPropsWithRef, use, useState } from "react";

export type DisplayAttributes = Omit<ComponentPropsWithRef<"output">, "children">;

export default function Display({ className, style, ...attributes }: DisplayAttributes) {
  const [none] = useState(0);
  const count = use(CountKey) ?? refObject(none);

  return (
    <output className={className} style={style} {...attributes}>
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
