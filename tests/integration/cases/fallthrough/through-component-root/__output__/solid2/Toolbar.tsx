import SaveAction from "./SaveAction";
import type { ComponentProps, JSX } from "@solidjs/web";
import { createSignal, getObserver, onCleanup } from "solid-js";

export default function Toolbar(
  props: Omit<ComponentProps<"div">, "class" | "style"> & {
    class?: string;
    style?: JSX.CSSProperties;
  },
) {
  const [clicks, setClicks] = createState(0);
  let save: HTMLButtonElement | null = null;

  return (
    <div role="toolbar" aria-label="Actions" {...props}>
      <SaveAction
        ref={clearedRef(
          (element) => {
            save = element;
          },
          () => {
            save = null;
          },
        )}
        text="Save"
        id="save"
        aria-label="Save draft"
        onClick={() => setClicks(clicks() + 1)}
      />
      <button type="button" onClick={() => save?.focus()}>
        Focus save
      </button>
      <p>Clicks: {clicks()}</p>
    </div>
  );
}

/** A `ref` that calls `callback` with its element, and `clear` once the element is removed. */
function clearedRef<T>(callback: (element: T) => void, clear: () => void): (element: T) => void {
  onCleanup(clear);
  return callback;
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
