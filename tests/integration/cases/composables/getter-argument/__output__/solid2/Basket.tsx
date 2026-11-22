import { useTotal } from "./useTotal";
import type { ComponentProps, JSX } from "@solidjs/web";
import { createSignal, getObserver, omit } from "solid-js";

export default function Basket(
  props: { price: number } & Omit<ComponentProps<"section">, "price" | "class" | "style"> & {
      class?: string;
      style?: JSX.CSSProperties;
    },
) {
  const others = omit(props, "price", "class");

  const [quantity, setQuantity] = createState(1);
  const { total, label } = useTotal(
    () => props.price,
    () => quantity(),
  );

  return (
    <section
      class={props.class ? `basket ${props.class}` : "basket"}
      aria-label="Basket"
      {...others}
    >
      <p role="status">Total: {total()}</p>
      <p>{label()}</p>
      <button type="button" onClick={() => setQuantity(quantity() + 1)}>
        Add one
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
