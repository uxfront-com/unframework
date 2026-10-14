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
          defaultChecked={drinks.includes("tea")}
          ref={(element) => {
            if (!element) return undefined;
            element.checked = drinks.includes("tea");
            const stop = listen(element, "change", () => {
              drinksRef.current = toggle(drinksRef.current, "tea", element.checked);
              setDrinks(drinksRef.current);
            });
            return () => {
              stop();
            };
          }}
        />{" "}
        Tea
      </label>
      <label>
        <input
          type="checkbox"
          value="coffee"
          defaultChecked={drinks.includes("coffee")}
          ref={(element) => {
            if (!element) return undefined;
            element.checked = drinks.includes("coffee");
            const stop = listen(element, "change", () => {
              drinksRef.current = toggle(drinksRef.current, "coffee", element.checked);
              setDrinks(drinksRef.current);
            });
            return () => {
              stop();
            };
          }}
        />{" "}
        Coffee
      </label>
      <label>
        <input
          type="checkbox"
          value="juice"
          defaultChecked={drinks.includes("juice")}
          ref={(element) => {
            if (!element) return undefined;
            element.checked = drinks.includes("juice");
            const stop = listen(element, "change", () => {
              drinksRef.current = toggle(drinksRef.current, "juice", element.checked);
              setDrinks(drinksRef.current);
            });
            return () => {
              stop();
            };
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

/**
 * Listens to a DOM event natively, where React's synthetic event would not keep the DOM's
 * semantics, and gives back what stops it: the cleanup a ref callback returns.
 */
function listen<K extends keyof HTMLElementEventMap>(
  element: EventTarget | null,
  type: K,
  listener: (event: HTMLElementEventMap[K]) => void,
  options?: AddEventListenerOptions,
): () => void {
  element?.addEventListener(type, listener as EventListener, options);
  return () => element?.removeEventListener(type, listener as EventListener, options);
}

/** The array with `value` added when `checked`, and without it otherwise. */
function toggle<T>(values: T[], value: T, checked: boolean): T[] {
  const index = values.indexOf(value);
  if (checked && index === -1) return [...values, value];
  if (!checked && index !== -1) return values.filter((_, at) => at !== index);
  return values;
}
