import Field from "./Field";
import { type ComponentPropsWithRef, useRef, useState } from "react";

export type FormAttributes = Omit<ComponentPropsWithRef<"section">, "city" | "children">;

export default function Form({
  city,
  className,
  style,
  ...attributes
}: { city: string } & FormAttributes) {
  const [cleared, setCleared] = useState("nothing");
  const clearedRef = useRef(cleared);

  function clear(label: string) {
    clearedRef.current = label;
    setCleared(clearedRef.current);
  }

  return (
    <section aria-label="Address" className={className} style={style} {...attributes}>
      <Field label="Street" onClear={clear} />
      <Field label={city} tone="warn" onClear={(label) => clear(label.toUpperCase())} />
      <output>Cleared: {cleared}</output>
    </section>
  );
}
