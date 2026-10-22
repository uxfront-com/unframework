import PriceRange from "./PriceRange";
import { type CSSProperties, useRef, useState } from "react";

export interface SearchAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function Search({ className, style, ...attributes }: SearchAttributes) {
  const [low, setLow] = useState(20);
  const [high, setHigh] = useState(50);
  const highRef = useRef(high);

  return (
    <section
      aria-label="Search"
      className={className}
      style={style}
      {...scopeAttributes(attributes)}
    >
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

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const key of Object.keys(props)) {
    if (key.startsWith("data-uf-")) scope[key] = "";
  }
  return scope;
}
