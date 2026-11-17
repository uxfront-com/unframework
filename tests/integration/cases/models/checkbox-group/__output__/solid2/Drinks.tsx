import type { JSX } from "@solidjs/web";
import { createSignal, getObserver } from "solid-js";

export default function Drinks(props: { class?: string; style?: JSX.CSSProperties }) {
  const [drinks, setDrinks] = createState<string[]>(["tea"]);

  return (
    <fieldset class={props.class} style={props.style} {...scopeAttributes(props)}>
      <legend>Drinks</legend>
      <label>
        <input
          type="checkbox"
          value="tea"
          checked={drinks().includes("tea")}
          onChange={(event) => setDrinks(toggle(drinks(), "tea", event.currentTarget.checked))}
        />{" "}
        Tea
      </label>
      <label>
        <input
          type="checkbox"
          value="coffee"
          checked={drinks().includes("coffee")}
          onChange={(event) => setDrinks(toggle(drinks(), "coffee", event.currentTarget.checked))}
        />{" "}
        Coffee
      </label>
      <label>
        <input
          type="checkbox"
          value="juice"
          checked={drinks().includes("juice")}
          onChange={(event) => setDrinks(toggle(drinks(), "juice", event.currentTarget.checked))}
        />{" "}
        Juice
      </label>
      <output>Ordered: {drinks().join(", ") || "nothing"}</output>
      <button type="button" onClick={() => setDrinks(["juice"])}>
        Only juice
      </button>
    </fieldset>
  );
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
}

/** The values with `value` added when `checked`, and removed otherwise. */
function toggle<T>(values: readonly T[], value: T, checked: boolean): T[] {
  return checked ? [...values, value] : values.filter((each) => each !== value);
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
