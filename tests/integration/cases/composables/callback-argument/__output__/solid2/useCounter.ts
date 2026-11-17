import { createSignal, getObserver } from "solid-js";

const step = 1;

export function useCounter(limit: number, onLimit: (count: number) => void) {
  const [count, setCount] = createState(0);

  function increment() {
    setCount(count() + step);
    if (count() === limit) onLimit(count());
  }

  function reset() {
    setCount(0);
  }

  return { count, step, increment, reset };
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
