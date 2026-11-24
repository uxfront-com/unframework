import type { ComponentProps, JSX } from "@solidjs/web";
import {
  For,
  createEffect,
  createMemo,
  createSignal,
  getObserver,
  omit,
  onCleanup,
  untrack,
} from "solid-js";

import { SelectRow } from "./SelectRow";

export default function SelectRows(
  props: { values: string[] } & Omit<
    ComponentProps<"select">,
    "values" | "class" | "style" | "onChange"
  > & {
      class?: string;
      style?: JSX.CSSProperties;
      onChange?: Extract<ComponentProps<"select">["onChange"], (event: never) => void>;
    },
) {
  const others = omit(props, "values", "onChange");

  const [size, setSize] = createState("y");

  return (
    <select
      aria-label="Size"
      onChange={(event) => {
        setSize(event.currentTarget.value);
        props.onChange?.(event);
      }}
      ref={selectOptions(size)}
      {...others}
    >
      <KeyedFor each={props.values} by={(value) => value}>
        {(value) => <SelectRow value={value.value} />}
      </KeyedFor>
    </select>
  );
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
 * The `ref` of a `<select>` whose options that hold `value`, or a value of it for an array, it
 * selects, and none where none holds it: as the value changes, and as options come and go.
 */
function selectOptions(value: () => unknown): (select: HTMLSelectElement) => void {
  let bound: HTMLSelectElement | undefined;
  let observer: MutationObserver | undefined;
  const choose = (current: unknown) => {
    const select = bound;
    if (!select) return;
    if (!Array.isArray(current)) {
      // `selectedIndex` -1 where no option holds it: unselecting each one selects the first.
      select.selectedIndex = [...select.options].findIndex(
        (option) => option.value === String(current),
      );
      return;
    }
    for (const option of select.options) option.selected = current.includes(option.value);
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
