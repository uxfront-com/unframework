import { createSignal, getObserver, onSettled } from "solid-js";

export function useMediaQuery(query: string) {
  const [matches, setMatches] = createState(false);
  let list: MediaQueryList | undefined;

  function update() {
    setMatches(list?.matches ?? false);
  }

  onSettled(() => {
    list = window.matchMedia(query);
    update();
    list.addEventListener("change", update);
  });

  onSettled(() => () => {
    list?.removeEventListener("change", update);
  });

  return { matches };
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
