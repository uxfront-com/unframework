import Picker from "./Picker";
import { vMark } from "./vMark";
import { vTrace } from "./vTrace";
import type { JSX } from "@solidjs/web";
import { For, Show, createMemo, createSignal, getObserver, untrack } from "solid-js";

export default function Menu(props: { class?: string; style?: JSX.CSSProperties }) {
  const [items, setItems] = createState<{ id: string; label: string; note?: string }[]>([
    { id: "a", label: "Alpha", note: "First" },
    { id: "b", label: "Beta" },
    { id: "c", label: "Gamma" },
  ]);
  const [prefix, setPrefix] = createState("Open");
  const [focused, setFocused] = createState(0);

  return (
    <section
      class={props.class ? `menu ${props.class}` : "menu"}
      aria-label="Menu"
      style={props.style}
      {...scopeAttributes(props)}
    >
      <ul aria-label="Items">
        <KeyedFor each={items()} by={(item) => item.id}>
          {(item) => (
            <li data-name={item.value.id} ref={vTrace(() => item.value.label)}>
              {item.value.label}
              <Show
                when={item.value.note ? { item: item.value, note: item.value.note } : undefined}
              >
                {(narrowed) => (
                  <b data-name={`note-${narrowed().item.id}`} ref={vTrace(() => narrowed().note)}>
                    {narrowed().note}
                  </b>
                )}
              </Show>
            </li>
          )}
        </KeyedFor>
      </ul>
      <ul aria-label="Marked">
        <KeyedFor each={items()} by={(item) => item.id}>
          {(item) => (
            <li
              data-name={`both-${item.value.id}`}
              ref={[vTrace(() => item.value.label), vMark(() => item.value.id)]}
            >
              {item.value.label}
            </li>
          )}
        </KeyedFor>
      </ul>
      <div class="focus">
        <KeyedFor each={items()} by={(item) => item.id}>
          {(item) => (
            <button
              type="button"
              data-name={`focus-${item.value.id}`}
              onFocusIn={() => setFocused(focused() + 1)}
              ref={vTrace(() => item.value.label)}
            >
              Focus {item.value.label}
            </button>
          )}
        </KeyedFor>
      </div>
      <output>{focused()}</output>
      <ul aria-label="Prefixed">
        <KeyedFor each={items()} by={(item) => item.id}>
          {(item) => (
            <li
              data-name={`prefixed-${item.value.id}`}
              ref={vTrace(() => `${prefix()} ${item.value.label}`)}
            >
              {item.value.label}
            </li>
          )}
        </KeyedFor>
      </ul>
      <Picker
        option={({ option }) => (
          <span data-name={`option-${option.id}`} ref={vTrace(() => `${prefix()} ${option.label}`)}>
            {option.label}
          </span>
        )}
      />
      <button
        type="button"
        onClick={() =>
          setItems(
            items().map((item) =>
              item.id === "a" ? { id: "a", label: "Alpha 2", note: "First" } : item,
            ),
          )
        }
      >
        Rename first
      </button>
      <button type="button" onClick={() => setItems([...items()].reverse())}>
        Reverse
      </button>
      <button type="button" onClick={() => setItems(items().filter((item) => item.id !== "b"))}>
        Remove second
      </button>
      <button type="button" onClick={() => setItems([...items(), { id: "d", label: "Delta" }])}>
        Add item
      </button>
      <button type="button" onClick={() => setPrefix("Close")}>
        Change prefix
      </button>
    </section>
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
