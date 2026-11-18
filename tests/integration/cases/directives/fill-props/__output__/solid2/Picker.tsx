import type { JSX } from "@solidjs/web";
import { For, createMemo, createSignal, getObserver, untrack } from "solid-js";

export interface PickerSlots {
  option?: (props: { option: { id: string; label: string } }) => JSX.Element;
}

export default function Picker(props: PickerSlots & { class?: string; style?: JSX.CSSProperties }) {
  const [options, setOptions] = createState([
    { id: "x", label: "Xray" },
    { id: "y", label: "Yankee" },
  ]);

  return (
    <div
      class={props.class ? `picker ${props.class}` : "picker"}
      style={props.style}
      {...scopeAttributes(props)}
    >
      <ul aria-label="Options">
        <KeyedFor each={options()} by={(option) => option.id}>
          {(option) => <li>{props.option?.({ option: option.value })}</li>}
        </KeyedFor>
      </ul>
      <button
        type="button"
        onClick={() =>
          setOptions(
            options().map((option) => (option.id === "x" ? { id: "x", label: "Xenon" } : option)),
          )
        }
      >
        Rename option
      </button>
    </div>
  );
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
}

/** A list whose rows follow their keys, so a row keeps its element while the list reorders and while its item is replaced. */
function KeyedFor<T>(props: {
  each: readonly T[];
  by: (item: T, index: number) => unknown;
  children: (row: { readonly value: T; readonly index: number }) => JSX.Element;
}): JSX.Element {
  const items = createMemo(() => {
    const rows = new Map<unknown, T>();
    props.each.forEach((item, index) => {
      const key = props.by(item, index);
      rows.set(rows.has(key) ? {} : key, item);
    });
    return rows;
  });
  return (
    <For each={[...items().keys()]}>
      {(key, index) => {
        const item = createMemo(() => items().get(key) as T);
        return untrack(() =>
          props.children({
            get value() {
              return item();
            },
            get index() {
              return index();
            },
          }),
        );
      }}
    </For>
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
