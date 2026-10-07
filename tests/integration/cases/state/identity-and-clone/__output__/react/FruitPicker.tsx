import { useRef, useState } from "react";

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

export default function FruitPicker({ fruits, onKept }: FruitPickerProps & FruitPickerEvents) {
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
    <section className="fruit-picker" aria-label="Fruit">
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
