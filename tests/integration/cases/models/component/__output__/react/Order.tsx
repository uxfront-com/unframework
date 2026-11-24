import Stepper from "./Stepper";
import { type ComponentPropsWithRef, useRef, useState } from "react";

export type OrderAttributes = Omit<ComponentPropsWithRef<"section">, "children">;

export default function Order({ className, style, ...attributes }: OrderAttributes) {
  const [cups, setCups] = useState(2);
  const cupsRef = useRef(cups);

  return (
    <section aria-label="Order" className={className} style={style} {...attributes}>
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
