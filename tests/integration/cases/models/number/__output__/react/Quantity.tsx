import { scopeAttributes } from "./_unframework/scopeAttributes";
import { useModelText } from "./_unframework/useModelText";
import { type CSSProperties, useRef, useState } from "react";

export interface QuantityAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function Quantity({ className, style, ...attributes }: QuantityAttributes) {
  const [count, setCount] = useState(2);
  const countRef = useRef(count);
  const [volume, setVolume] = useState(5);
  const countField = useModelText(
    count,
    (value) => {
      countRef.current = value;
      setCount(countRef.current);
    },
    { number: true },
  );
  const volumeField = useModelText(volume, setVolume, { number: true });

  return (
    <section
      aria-label="Order"
      className={className}
      style={style}
      {...scopeAttributes(attributes)}
    >
      <input type="number" aria-label="Count" min="0" {...countField} />
      <input type="range" aria-label="Volume" min="0" max="10" {...volumeField} />
      <output>
        Next: {count + 1}, volume {volume + 1}
      </output>
      <button
        type="button"
        onClick={() => {
          countRef.current = 10;
          setCount(countRef.current);
        }}
      >
        Ten
      </button>
    </section>
  );
}
