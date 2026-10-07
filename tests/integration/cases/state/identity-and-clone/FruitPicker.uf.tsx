import { defineEmits, ref } from "unframework";

export interface Fruit {
  name: string;
  colour: string;
}

export interface FruitPickerProps {
  fruits: Fruit[];
}

export default function FruitPicker({ fruits }: FruitPickerProps) {
  const emit = defineEmits<{ kept: [name: string, colour: string] }>();

  const selected = ref<Fruit | null>(null);
  const basket = ref<Fruit[]>([]);

  function pick(fruit: Fruit) {
    selected.value = fruit;
  }

  function keep() {
    const current = selected.value;
    if (!current) return;
    const copy = structuredClone(current);
    basket.value = [...basket.value, copy];
    emit("kept", copy.name, copy.colour);
  }

  return (
    <section class="fruit-picker" aria-label="Fruit">
      <ul aria-label="Fruits">
        {fruits.map((fruit) => (
          <li key={fruit.name}>
            <button
              type="button"
              aria-pressed={fruit === selected.value}
              onClick={() => pick(fruit)}
            >
              {fruit.name}
            </button>
          </li>
        ))}
      </ul>
      <button type="button" onClick={keep}>
        Keep a copy
      </button>
      <ol aria-label="Basket">
        {basket.value.map((fruit, index) => (
          <li key={index}>{`${fruit.name} (${fruit.colour})`}</li>
        ))}
      </ol>
    </section>
  );
}
