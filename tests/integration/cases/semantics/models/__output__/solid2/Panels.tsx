import Disclosure from "./Disclosure";
import type { ComponentProps, JSX } from "@solidjs/web";
import { createSignal, getObserver } from "solid-js";

export default function Panels(
  props: Omit<ComponentProps<"section">, "class" | "style"> & {
    class?: string;
    style?: JSX.CSSProperties;
  },
) {
  const [shipping, setShipping] = createState(true);

  return (
    <section aria-label="Panels" {...props}>
      <Disclosure title="Shipping" open={shipping()} onOpenChange={setShipping} />
      <Disclosure title="Returns" />
      <output>Shipping is {shipping() ? "open" : "closed"}</output>
      <button type="button" onClick={() => setShipping(!shipping())}>
        Toggle shipping
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
