import Stepper from "./Stepper";
import { scopeAttributes } from "./_unframework/scopeAttributes";
import { type CSSProperties, useRef, useState } from "react";

export interface OrderAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function Order({ className, style, ...attributes }: OrderAttributes) {
  const [cups, setCups] = useState(2);
  const cupsRef = useRef(cups);

  return (
    <section
      aria-label="Order"
      className={className}
      style={style}
      {...scopeAttributes(attributes)}
    >
      <Stepper
        label="Cups"
        value={cups}
        onValueChange={(value) => {
          cupsRef.current = value;
          setCups(cupsRef.current);
        }}
      />
      <output>Ordered: {cups}</output>
      <button
        type="button"
        onClick={() => {
          cupsRef.current = 0;
          setCups(cupsRef.current);
        }}
      >
        Clear
      </button>
    </section>
  );
}
