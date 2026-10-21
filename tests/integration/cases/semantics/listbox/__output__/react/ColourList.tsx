import { type CSSProperties, useRef, useState } from "react";

export interface ColourListAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function ColourList({ className, style, ...attributes }: ColourListAttributes) {
  const [colour, setColour] = useState("none");
  const colourRef = useRef(colour);

  return (
    <section
      aria-label="Colours"
      className={className}
      style={style}
      {...scopeAttributes(attributes)}
    >
      <select
        size={3}
        aria-label="Colour"
        onChange={(event) => {
          colourRef.current = (event.currentTarget as HTMLSelectElement).value;
          setColour(colourRef.current);
        }}
      >
        <option value="red">Red</option>
        <option value="green">Green</option>
        <option value="blue">Blue</option>
      </select>
      <output>Picked: {colour}</output>
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
