import Display from "./Display";
import type { ComponentProps, JSX } from "@solidjs/web";
import { createContext, createSignal, getObserver } from "solid-js";

export const CountKey = createContext<{ readonly value: number } | null>(null);

export default function Counter(
  props: Omit<ComponentProps<"section">, "class" | "style"> & {
    class?: string;
    style?: JSX.CSSProperties;
  },
) {
  const [count, setCount] = createState(1);

  return (
    <CountKey
      value={{
        get value() {
          return count();
        },
      }}
    >
      <section aria-label="Counter" {...props}>
        <Display />
        <button type="button" onClick={() => setCount(count() + 1)}>
          Add one
        </button>
      </section>
    </CountKey>
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
