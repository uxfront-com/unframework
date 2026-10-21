import { type CSSProperties, useRef, useState } from "react";

export interface Fruit {
  name: string;
  colour: string;
}

export interface FruitPickerProps {
  fruits: Fruit[];
}

export interface FruitPickerEvents {
  onKept?: (name: string, colour: string) => void;
}

export interface FruitPickerAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function FruitPicker({
  fruits,
  onKept,
  className,
  style,
  ...attributes
}: FruitPickerProps & FruitPickerEvents & FruitPickerAttributes) {
  const [selected, setSelected] = useState<Fruit | null>(null);
  const selectedRef = useRef(selected);
  const [basket, setBasket] = useState<Fruit[]>([]);
  const basketRef = useRef(basket);

  function pick(fruit: Fruit) {
    selectedRef.current = fruit;
    setSelected(selectedRef.current);
  }

  function keep() {
    const current = selectedRef.current;
    if (!current) return;
    const copy = structuredClone(current);
    basketRef.current = [...basketRef.current, copy];
    setBasket(basketRef.current);
    onKept?.(copy.name, copy.colour);
  }

  return (
    <section
      className={cx("fruit-picker", className)}
      aria-label="Fruit"
      style={style}
      {...scopeAttributes(attributes)}
    >
      <ul aria-label="Fruits">
        {fruits.map((fruit) => (
          <li key={fruit.name}>
            <button type="button" aria-pressed={fruit === selected} onClick={() => pick(fruit)}>
              {fruit.name}
            </button>
          </li>
        ))}
      </ul>
      <button type="button" onClick={keep}>
        Keep a copy
      </button>
      <ol aria-label="Basket">
        {basket.map((fruit, index) => (
          <li key={index}>{`${fruit.name} (${fruit.colour})`}</li>
        ))}
      </ol>
    </section>
  );
}

/** Joins class names, and the keys of an object's truthy entries, into one `className`. */
function cx(...parts: unknown[]): string {
  const names: string[] = [];
  for (const part of parts) {
    if (typeof part === "string") {
      if (part) names.push(part);
    } else if (part && typeof part === "object") {
      for (const [key, on] of Object.entries(part)) {
        if (on) names.push(key);
      }
    }
  }
  return names.join(" ");
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const key of Object.keys(props)) {
    if (key.startsWith("data-uf-")) scope[key] = "";
  }
  return scope;
}
