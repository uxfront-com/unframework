import { formatPrice, pluralise } from "./format";
import type { ComponentProps, JSX } from "@solidjs/web";
import { createSignal, getObserver, omit } from "solid-js";

export interface PriceTagEvents {
  onOrder?: (summary: string) => void;
}

export default function PriceTag(
  props: { cents: number } & PriceTagEvents &
    Omit<ComponentProps<"section">, "cents" | "class" | "style"> & {
      class?: string;
      style?: JSX.CSSProperties;
    },
) {
  const others = omit(props, "cents", "onOrder", "class");

  const [quantity, setQuantity] = createState(1);
  const total = () => formatPrice(props.cents * quantity());

  function order() {
    props.onOrder?.(`${pluralise(quantity(), "item")} for ${total()}`);
  }

  return (
    <section
      class={props.class ? `price-tag ${props.class}` : "price-tag"}
      aria-label="Price"
      {...others}
    >
      <p>Each: {formatPrice(props.cents)}</p>
      <p role="status">
        {pluralise(quantity(), "item")}: {total()}
      </p>
      <button type="button" onClick={() => setQuantity(quantity() + 1)}>
        One more
      </button>
      <button type="button" onClick={order}>
        Order
      </button>
    </section>
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
