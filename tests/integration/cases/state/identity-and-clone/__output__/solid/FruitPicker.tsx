import { type Accessor, For, type JSX, createMemo, createSignal, untrack } from "solid-js";

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
  props: FruitPickerProps & FruitPickerEvents & { class?: string; style?: JSX.CSSProperties },
) {
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
      style={props.style}
      {...scopeAttributes(props)}
    >
      <ul aria-label="Fruits">
        <KeyedFor each={props.fruits} by={(fruit) => fruit.name}>
          {(fruit) => (
            <li>
              <button
                type="button"
                aria-pressed={fruit() === selected()}
                onClick={() => pick(fruit())}
              >
                {fruit().name}
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
          {(fruit) => <li>{`${fruit().name} (${fruit().colour})`}</li>}
        </KeyedFor>
      </ol>
    </section>
  );
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
}

/** A list whose rows follow their keys, so a row keeps its element while the list reorders and while its item is replaced. */
function KeyedFor<T>(props: {
  each: readonly T[];
  by: (item: T, index: number) => unknown;
  children: (item: Accessor<T>, index: Accessor<number>) => JSX.Element;
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
        return untrack(() => props.children(item, index));
      }}
    </For>
  );
}
