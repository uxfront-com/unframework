import { type CSSProperties, useRef, useState } from "react";

export interface SizePickerAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function SizePicker({ className, style, ...attributes }: SizePickerAttributes) {
  const [size, setSize] = useState("m");
  const sizeRef = useRef(size);

  return (
    <section aria-label="Size" className={className} style={style} {...scopeAttributes(attributes)}>
      <label>
        Size{" "}
        <select
          value={size}
          onChange={(event) => {
            sizeRef.current = event.target.value;
            setSize(sizeRef.current);
          }}
        >
          <option value="s">Small</option>
          <option value="m">Medium</option>
          <option value="l">Large</option>
        </select>
      </label>
      <output>Chosen: {size}</output>
      <button
        type="button"
        onClick={() => {
          sizeRef.current = "l";
          setSize(sizeRef.current);
        }}
      >
        Largest
      </button>
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
