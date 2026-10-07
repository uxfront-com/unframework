import { $, type QRL, component$, useSignal } from "@qwik.dev/core";

export interface Fruit {
  name: string;
  colour: string;
}

export interface FruitPickerProps {
  fruits: Fruit[];
}

export interface FruitPickerEvents {
  onKept$?: QRL<(name: string, colour: string) => void>;
}

export default component$<FruitPickerProps & FruitPickerEvents>(({ fruits, onKept$ }) => {
  const selected = useSignal<Fruit | null>(null);
  const basket = useSignal<Fruit[]>([]);

  const pick = $((fruit: Fruit) => {
    selected.value = fruit;
  });

  const keep = $(() => {
    const current = selected.value;
    if (!current) return;
    const copy = structuredClone(current);
    basket.value = [...basket.value, copy];
    onKept$?.(copy.name, copy.colour);
  });

  return (
    <section class="fruit-picker" aria-label="Fruit">
      <ul aria-label="Fruits">
        {fruits.map((fruit) => (
          <li key={fruit.name}>
            <button
              type="button"
              aria-pressed={fruit === selected.value}
              onClick$={() => pick(fruit)}
            >
              {fruit.name}
            </button>
          </li>
        ))}
      </ul>
      <button type="button" onClick$={keep}>
        Keep a copy
      </button>
      <ol aria-label="Basket">
        {basket.value.map((fruit, index) => (
          <li key={index}>{`${fruit.name} (${fruit.colour})`}</li>
        ))}
      </ol>
    </section>
  );
});
