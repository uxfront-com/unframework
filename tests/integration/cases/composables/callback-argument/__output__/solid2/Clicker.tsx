import { useCounter } from "./useCounter";
import type { ComponentProps, JSX } from "@solidjs/web";
import { createSignal, getObserver, omit } from "solid-js";

export interface ClickerEvents {
  onLimit?: (count: number) => void;
}

export default function Clicker(
  props: ClickerEvents &
    Omit<ComponentProps<"section">, "class" | "style"> & {
      class?: string;
      style?: JSX.CSSProperties;
    },
) {
  const others = omit(props, "onLimit", "class");

  const [message, setMessage] = createState("Keep going");
  const { count, step, increment, reset } = useCounter(3, (reached) => {
    setMessage(`Reached ${reached}`);
    props.onLimit?.(reached);
  });

  return (
    <section
      class={props.class ? `clicker ${props.class}` : "clicker"}
      aria-label="Clicker"
      {...others}
    >
      <p role="status">Count: {count()}</p>
      <p>{message()}</p>
      <button type="button" onClick={() => increment()}>
        Add {step}
      </button>
      <button type="button" onClick={() => reset()}>
        Reset
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
