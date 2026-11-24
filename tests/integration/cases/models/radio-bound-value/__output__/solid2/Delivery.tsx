import type { ComponentProps, JSX } from "@solidjs/web";
import { For, createMemo, createSignal, getObserver, omit, untrack } from "solid-js";

export interface DeliveryProps {
  speeds: string[];
  extras: string[];
}

export default function Delivery(
  props: DeliveryProps &
    Omit<ComponentProps<"section">, "speeds" | "extras" | "class" | "style"> & {
      class?: string;
      style?: JSX.CSSProperties;
    },
) {
  const others = omit(props, "speeds", "extras");

  const [speed, setSpeed] = createState("express");
  const [chosen, setChosen] = createState<string[]>(["insurance"]);

  return (
    <section aria-label="Delivery" {...others}>
      <fieldset>
        <legend>Speed</legend>
        <KeyedFor each={props.speeds} by={(value) => value}>
          {(value) => (
            <label>
              <input
                type="radio"
                name="speed"
                value={value.value}
                checked={speed() === value.value}
                onChange={() => setSpeed(value.value)}
              />{" "}
              {value.value}
            </label>
          )}
        </KeyedFor>
      </fieldset>
      <fieldset>
        <legend>Extras</legend>
        <KeyedFor each={props.extras} by={(extra) => extra}>
          {(extra) => (
            <label>
              <input
                type="checkbox"
                value={extra.value}
                checked={chosen().includes(extra.value)}
                onChange={(event) =>
                  setChosen(toggle(chosen(), extra.value, event.currentTarget.checked))
                }
              />{" "}
              {extra.value}
            </label>
          )}
        </KeyedFor>
      </fieldset>
      <output>
        Speed: {speed()}, extras: {chosen().join(", ") || "none"}
      </output>
    </section>
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
