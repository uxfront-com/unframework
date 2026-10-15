import { type CSSProperties, useRef, useState } from "react";

export interface DrinksAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function Drinks({ className, style }: DrinksAttributes) {
  const [drinks, setDrinks] = useState<string[]>(["tea"]);
  const drinksRef = useRef(drinks);

  return (
    <fieldset className={className} style={style}>
      <legend>Drinks</legend>
      <label>
        <input
          type="checkbox"
          value="tea"
          checked={drinks.includes("tea")}
          onChange={(event) => {
            drinksRef.current = toggle(drinksRef.current, "tea", event.target.checked);
            setDrinks(drinksRef.current);
          }}
        />{" "}
        Tea
      </label>
      <label>
        <input
          type="checkbox"
          value="coffee"
          checked={drinks.includes("coffee")}
          onChange={(event) => {
            drinksRef.current = toggle(drinksRef.current, "coffee", event.target.checked);
            setDrinks(drinksRef.current);
          }}
        />{" "}
        Coffee
      </label>
      <label>
        <input
          type="checkbox"
          value="juice"
          checked={drinks.includes("juice")}
          onChange={(event) => {
            drinksRef.current = toggle(drinksRef.current, "juice", event.target.checked);
            setDrinks(drinksRef.current);
          }}
        />{" "}
        Juice
      </label>
      <output>Ordered: {drinks.join(", ") || "nothing"}</output>
      <button
        type="button"
        onClick={() => {
          drinksRef.current = ["juice"];
          setDrinks(drinksRef.current);
        }}
      >
        Only juice
      </button>
    </fieldset>
  );
}

/** The array with `value` added when `checked`, and without it otherwise. */
function toggle<T>(values: T[], value: T, checked: boolean): T[] {
  const index = values.indexOf(value);
  if (checked && index === -1) return [...values, value];
  if (!checked && index !== -1) return values.filter((_, at) => at !== index);
  return values;
}
