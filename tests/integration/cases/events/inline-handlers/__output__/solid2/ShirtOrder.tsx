import type { ComponentProps, JSX } from "@solidjs/web";
import { createSignal, getObserver, omit, onCleanup } from "solid-js";

export default function ShirtOrder(
  props: Omit<ComponentProps<"section">, "class" | "style"> & {
    class?: string;
    style?: JSX.CSSProperties;
  },
) {
  const others = omit(props, "class");

  const [size, setSize] = createState("M");
  const [quantity, setQuantity] = createState(1);
  const [note, setNote] = createState("");
  let noteField: HTMLInputElement | null = null;

  return (
    <section
      class={props.class ? `shirt-order ${props.class}` : "shirt-order"}
      aria-label="Shirt order"
      {...others}
    >
      <p role="status">{`${quantity()} x size ${size()}`}</p>
      <div role="group" aria-label="Size">
        <button
          type="button"
          value="S"
          aria-pressed={enumeratedValue(size() === "S")}
          onClick={(event) => setSize((event.currentTarget as HTMLButtonElement).value)}
        >
          Small
        </button>
        <button
          type="button"
          value="M"
          aria-pressed={enumeratedValue(size() === "M")}
          onClick={(event) => setSize((event.currentTarget as HTMLButtonElement).value)}
        >
          Medium
        </button>
        <button
          type="button"
          value="L"
          aria-pressed={enumeratedValue(size() === "L")}
          onClick={(event) => setSize((event.currentTarget as HTMLButtonElement).value)}
        >
          Large
        </button>
      </div>
      <button type="button" onClick={() => setQuantity(quantity() + 1)}>
        Add one
      </button>
      <label>
        Note
        <input
          name="note"
          ref={clearedRef(
            (element) => {
              noteField = element;
            },
            () => {
              noteField = null;
            },
          )}
          onInput={(event) => setNote((event.currentTarget as HTMLInputElement).value)}
        />
      </label>
      <p>Note: {note()}</p>
      <button
        type="button"
        onClick={() => {
          setQuantity(1);
          setSize("M");
          setNote("");
          const input = noteField;
          if (input) input.value = "";
        }}
      >
        Reset
      </button>
    </section>
  );
}

/** An enumerated attribute's value: a boolean as `"true"` or `"false"`, as Vue writes it. */
function enumeratedValue<T>(value: T): T extends boolean ? `${T}` : T {
  return (typeof value === "boolean" ? String(value) : value) as T extends boolean ? `${T}` : T;
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
