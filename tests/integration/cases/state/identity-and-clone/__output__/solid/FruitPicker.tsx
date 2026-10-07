import { For, createSignal } from "solid-js";

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

export default function FruitPicker(props: FruitPickerProps & FruitPickerEvents) {
  const [selected, setSelected] = createSignal<Fruit | null>(null);
  const [basket, setBasket] = createSignal<Fruit[]>([]);

  function pick(fruit: Fruit) {
    setSelected(fruit);
  }

  function keep() {
    const current = selected();
    if (!current) return;
    const copy = structuredClone(current);
    setBasket([...basket(), copy]);
    props.onKept?.(copy.name, copy.colour);
  }

  return (
    <section class="fruit-picker" aria-label="Fruit">
      <ul aria-label="Fruits">
        <For each={props.fruits}>
          {(fruit) => (
            <li>
              <button type="button" aria-pressed={fruit === selected()} onClick={() => pick(fruit)}>
                {fruit.name}
              </button>
            </li>
          )}
        </For>
      </ul>
      <button type="button" onClick={keep}>
        Keep a copy
      </button>
      <ol aria-label="Basket">
        <For each={basket()}>{(fruit) => <li>{`${fruit.name} (${fruit.colour})`}</li>}</For>
      </ol>
    </section>
  );
}
