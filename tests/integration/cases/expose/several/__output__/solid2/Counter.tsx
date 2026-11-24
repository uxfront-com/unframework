import type { ComponentProps, JSX } from "@solidjs/web";
import { createSignal, getObserver, omit, untrack } from "solid-js";

export default function Counter(
  props: { start: number } & Omit<ComponentProps<"output">, "start" | "ref" | "class" | "style"> & {
      class?: string;
      style?: JSX.CSSProperties;
      ref?: (api: { increment: () => void; reset: () => void }) => void;
    },
) {
  const others = omit(props, "start", "ref", "class");

  const [count, setCount] = createState(untrack(() => props.start));

  function increment() {
    setCount(count() + 1);
  }

  const reset = () => {
    setCount(props.start);
  };

  untrack(() => props.ref?.({ increment, reset }));

  return (
    <output class={props.class ? `count ${props.class}` : "count"} {...others}>
      {count()}
    </output>
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
