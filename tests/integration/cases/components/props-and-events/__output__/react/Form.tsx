import Field from "./Field";
import { type CSSProperties, useRef, useState } from "react";

export interface FormAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function Form({ city, className, style }: { city: string } & FormAttributes) {
  const [cleared, setCleared] = useState("nothing");
  const clearedRef = useRef(cleared);

  function clear(label: string) {
    clearedRef.current = label;
    setCleared(clearedRef.current);
  }

  return (
    <section aria-label="Address" className={className} style={style}>
      <Field label="Street" onClear={clear} />
      <Field label={city} tone="warn" onClear={(label) => clear(label.toUpperCase())} />
      <output>Cleared: {cleared}</output>
    </section>
  );
}
