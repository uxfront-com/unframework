import { type CSSProperties, useRef, useState } from "react";

export interface ToppingPickerAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function ToppingPicker({ className, style }: ToppingPickerAttributes) {
  const [toppings, setToppings] = useState<string[]>(["cheese"]);
  const toppingsRef = useRef(toppings);

  return (
    <section aria-label="Pizza" className={className} style={style}>
      <label>
        Toppings{" "}
        <select
          multiple
          value={toppings}
          onChange={(event) => {
            toppingsRef.current = Array.from(
              event.target.selectedOptions,
              (option) => option.value,
            );
            setToppings(toppingsRef.current);
          }}
        >
          <option value="cheese">Cheese</option>
          <option value="olives">Olives</option>
          <option value="basil">Basil</option>
        </select>
      </label>
      <output>On top: {toppings.join(", ") || "nothing"}</output>
      <button
        type="button"
        onClick={() => {
          toppingsRef.current = ["basil", "olives"];
          setToppings(toppingsRef.current);
        }}
      >
        Green
      </button>
    </section>
  );
}
