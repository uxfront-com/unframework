import Display from "./Display";
import type { JSX } from "@solidjs/web";
import { createContext, createSignal, getObserver } from "solid-js";

export const CountKey = createContext<{ readonly value: number } | null>(null);

export default function Counter(props: { class?: string; style?: JSX.CSSProperties }) {
  const [count, setCount] = createState(1);

  return (
    <CountKey
      value={{
        get value() {
          return count();
        },
      }}
    >
      <section
        aria-label="Counter"
        class={props.class}
        style={props.style}
        {...scopeAttributes(props)}
      >
        <Display />
        <button type="button" onClick={() => setCount(count() + 1)}>
          Add one
        </button>
      </section>
    </CountKey>
  );
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
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
