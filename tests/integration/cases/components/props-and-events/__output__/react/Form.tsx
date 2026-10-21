import Field from "./Field";
import { type CSSProperties, useRef, useState } from "react";

export interface FormAttributes {
  className?: string;
  style?: CSSProperties;
}

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
    <section
      aria-label="Address"
      className={className}
      style={style}
      {...scopeAttributes(attributes)}
    >
      <Field label="Street" onClear={clear} />
      <Field label={city} tone="warn" onClear={(label) => clear(label.toUpperCase())} />
      <output>Cleared: {cleared}</output>
    </section>
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
