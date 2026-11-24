import type { ComponentProps, JSX } from "@solidjs/web";
import { createSignal, getObserver } from "solid-js";

export default function ToppingPicker(
  props: Omit<ComponentProps<"section">, "class" | "style"> & {
    class?: string;
    style?: JSX.CSSProperties;
  },
) {
  const [toppings, setToppings] = createState<string[]>(["cheese"]);

  return (
    <section aria-label="Pizza" {...props}>
      <label>
        Toppings{" "}
        <select multiple onChange={(event) => setToppings(selectedValues(event.currentTarget))}>
          <option value="cheese" selected={toppings().includes("cheese")}>
            Cheese
          </option>
          <option value="olives" selected={toppings().includes("olives")}>
            Olives
          </option>
          <option value="basil" selected={toppings().includes("basil")}>
            Basil
          </option>
        </select>
      </label>
      <output>On top: {toppings().join(", ") || "nothing"}</output>
      <button type="button" onClick={() => setToppings(["basil", "olives"])}>
        Green
      </button>
    </section>
  );
}

/** The values of a `<select multiple>`'s selected options, in their order. */
function selectedValues(select: HTMLSelectElement): string[] {
  return Array.from(select.selectedOptions, (option) => option.value);
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
