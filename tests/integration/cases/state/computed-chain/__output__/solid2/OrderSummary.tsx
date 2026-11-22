import type { ComponentProps, JSX } from "@solidjs/web";
import { createSignal, getObserver, omit } from "solid-js";

export interface OrderSummaryProps {
  /** The unit price, in cents. */
  price: number;
  taxRate: number;
}

export default function OrderSummary(
  props: OrderSummaryProps &
    Omit<ComponentProps<"section">, "price" | "taxRate" | "class" | "style"> & {
      class?: string;
      style?: JSX.CSSProperties;
    },
) {
  const others = omit(props, "price", "taxRate", "class");

  const [quantity, setQuantity] = createState(1);
  const subtotal = () => quantity() * props.price;
  const tax = () => Math.round(subtotal() * props.taxRate);
  const total = () => subtotal() + tax();
  const tier = () => {
    if (total() >= 10000) return "bulk";
    return "standard";
  };

  return (
    <section
      class={props.class ? `order-summary ${props.class}` : "order-summary"}
      aria-label="Order summary"
      data-tier={tier()}
      {...others}
    >
      <p role="status">Quantity: {quantity()}</p>
      <button type="button" disabled={quantity() === 1} onClick={() => setQuantity(quantity() - 1)}>
        Remove one
      </button>
      <button type="button" onClick={() => setQuantity(quantity() + 1)}>
        Add one
      </button>
      <p>Subtotal: {(subtotal() / 100).toFixed(2)}</p>
      <p>Tax: {(tax() / 100).toFixed(2)}</p>
      <p>Total: {(total() / 100).toFixed(2)}</p>
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
