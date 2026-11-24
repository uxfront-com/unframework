import type { ComponentProps, JSX } from "@solidjs/web";
import { For, createMemo, createSignal, getObserver, omit, untrack } from "solid-js";

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
    Omit<ComponentProps<"section">, "fruits" | "class" | "style"> & {
      class?: string;
      style?: JSX.CSSProperties;
    },
) {
  const others = omit(props, "fruits", "onKept", "class");

  const [selected, setSelected] = createState<Fruit | null>(null);
  const [basket, setBasket] = createState<Fruit[]>([]);

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
                aria-pressed={enumeratedValue(fruit.value === selected())}
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

/** An enumerated attribute's value: a boolean as `"true"` or `"false"`, as Vue writes it. */
function enumeratedValue<T>(value: T): T extends boolean ? `${T}` : T {
  return (typeof value === "boolean" ? String(value) : value) as T extends boolean ? `${T}` : T;
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

/**
 * Vue's `ref`: a signal whose read returns the value last written, as Vue's does, and tracks the
 * signal where something observes it. Solid applies a write when it flushes.
 */
function createState<T>(): [() => T | undefined, (value: T | undefined) => void];
function createState<T>(initial: T): [() => T, (value: T) => void];
function createState<T>(initial?: T): [() => T | undefined, (value: T | undefined) => void] {
  let current = initial;
  // A version, never the value: `createSignal` would take a function for a computation.
  const [tracked, notify] = createSignal(0, { ownedWrite: true });
  function read(): T | undefined {
    if (getObserver()) tracked();
    return current;
  }
  function write(value: T | undefined): void {
    if (Object.is(value, current)) return;
    current = value;
    notify((version) => version + 1);
  }
  return [read, write];
}
