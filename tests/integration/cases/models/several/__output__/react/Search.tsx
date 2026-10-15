import PriceRange from "./PriceRange";
import { type CSSProperties, useRef, useState } from "react";

export interface SearchAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function Search({ className, style }: SearchAttributes) {
  const [low, setLow] = useState(20);
  const [high, setHigh] = useState(50);
  const highRef = useRef(high);

  return (
    <section aria-label="Search" className={className} style={style}>
      <PriceRange
        label="Price"
        min={low}
        onMinChange={setLow}
        max={high}
        onMaxChange={(value) => {
          highRef.current = value;
          setHigh(highRef.current);
        }}
      />
      <output>
        Between {low} and {high}
      </output>
      <button
        type="button"
        onClick={() => {
          highRef.current = 40;
          setHigh(highRef.current);
        }}
      >
        Cheaper
      </button>
    </section>
  );
}
