import {
  type ComponentProps,
  For,
  type JSX,
  createMemo,
  createSignal,
  splitProps,
  untrack,
} from "solid-js";

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

export default function FruitPicker(
  props: FruitPickerProps &
    FruitPickerEvents &
    Omit<ComponentProps<"section">, "fruits" | "style"> & { style?: JSX.CSSProperties },
) {
  const [, others] = splitProps(props, ["fruits", "onKept", "class"]);

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
    <section
      class={props.class ? `fruit-picker ${props.class}` : "fruit-picker"}
      aria-label="Fruit"
      {...others}
    >
      <ul aria-label="Fruits">
        <KeyedFor each={props.fruits} by={(fruit) => fruit.name}>
          {(fruit) => (
            <li>
              <button
                type="button"
                aria-pressed={fruit.value === selected()}
                onClick={() => pick(fruit.value)}
              >
                {fruit.value.name}
              </button>
            </li>
          )}
        </KeyedFor>
      </ul>
      <button type="button" onClick={keep}>
        Keep a copy
      </button>
      <ol aria-label="Basket">
        <KeyedFor each={basket()} by={(fruit, index) => index}>
          {(fruit) => <li>{`${fruit.value.name} (${fruit.value.colour})`}</li>}
        </KeyedFor>
      </ol>
    </section>
  );
}

/** A list whose rows follow their keys, so a row keeps its element while the list reorders and while its item is replaced. */
function KeyedFor<T>(props: {
  each: readonly T[];
  by: (item: T, index: number) => unknown;
  children: (row: { readonly value: T; readonly index: number }) => JSX.Element;
}): JSX.Element {
  const items = createMemo(() => {
    const rows = new Map<unknown, T>();
    props.each.forEach((item, index) => {
      const key = props.by(item, index);
      rows.set(rows.has(key) ? {} : key, item);
    });
    return rows;
  });
  return (
    <For each={[...items().keys()]}>
      {(key, index) => {
        const item = createMemo(() => items().get(key) as T);
        return untrack(() =>
          props.children({
            get value() {
              return item();
            },
            get index() {
              return index();
            },
          }),
        );
      }}
    </For>
  );
}
