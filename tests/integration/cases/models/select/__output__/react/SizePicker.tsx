import { type CSSProperties, useRef, useState } from "react";

export interface SizePickerAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function SizePicker({ className, style }: SizePickerAttributes) {
  const [size, setSize] = useState("m");
  const sizeRef = useRef(size);

  return (
    <section aria-label="Size" className={className} style={style}>
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
