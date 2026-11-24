import type { ComponentProps, JSX } from "@solidjs/web";
import {
  For,
  createEffect,
  createMemo,
  createSignal,
  getObserver,
  onCleanup,
  untrack,
} from "solid-js";

export default function ListedSelect(
  props: Omit<ComponentProps<"form">, "class" | "style"> & {
    class?: string;
    style?: JSX.CSSProperties;
  },
) {
  const [size, setSize] = createState("m");
  const [sizes, setSizes] = createState(["s", "m", "l"]);

  return (
    <form {...props}>
      <select
        aria-label="Size"
        onChange={(event) => setSize(event.currentTarget.value)}
        ref={selectOptions(size)}
      >
        <KeyedFor each={sizes()} by={(each) => each}>
          {(each) => (
            <option value={each.value} selected={size() === each.value}>
              {each.value}
            </option>
          )}
        </KeyedFor>
      </select>
      <button type="button" onClick={() => setSizes(["s", "l"])}>
        Drop M
      </button>
    </form>
  );
}

/** A list whose rows follow their keys, so a row keeps its element while the list reorders and while its item is replaced. */
function KeyedFor<T>(props: {
  each: ReadonlyArray<T>;
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
 * The `ref` of a `<select>` whose options that hold `value`, or a value of it for an array, it
 * selects, and none where none holds it: as the value changes, and as options come and go.
 */
function selectOptions(value: () => unknown): (select: HTMLSelectElement) => void {
  let bound: HTMLSelectElement | undefined;
  let observer: MutationObserver | undefined;
  const choose = (current: unknown) => {
    const select = bound;
    if (!select) {
      return;
    }
    if (!Array.isArray(current)) {
      // `selectedIndex` -1 where no option holds it: unselecting each one selects the first.
      select.selectedIndex = [...select.options].findIndex(
        (option) => option.value === String(current),
      );
      return;
    }
    for (const option of select.options) {
      option.selected = current.includes(option.value);
    }
  };
  // Created here, as the `ref` is evaluated: Solid 2 creates no computation in a `ref` callback.
  createEffect(value, choose);
  onCleanup(() => observer?.disconnect());
  return (select) => {
    bound = select;
    observer = new MutationObserver(() => choose(value()));
    observer.observe(select, { childList: true, subtree: true, attributeFilter: ["value"] });
  };
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
    if (getObserver()) {
      tracked();
    }
    return current;
  }
  function write(value: T | undefined): void {
    if (Object.is(value, current)) {
      return;
    }
    current = value;
    notify((version) => version + 1);
  }
  return [read, write];
}
