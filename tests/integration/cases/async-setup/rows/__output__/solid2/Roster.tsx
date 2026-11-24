import Member from "./Member";
import type { ComponentProps, JSX } from "@solidjs/web";
import { For, Show, createMemo, createSignal, getObserver, omit, untrack } from "solid-js";

export default function Roster(
  props: { ids: string[] } & Omit<ComponentProps<"section">, "ids" | "class" | "style"> & {
      class?: string;
      style?: JSX.CSSProperties;
    },
) {
  const others = omit(props, "ids", "class");

  const [lead, setLead] = createState(true);
  const [guest, setGuest] = createState(false);

  return (
    <section
      class={props.class ? `roster ${props.class}` : "roster"}
      aria-label="Roster"
      {...others}
    >
      <button type="button" onClick={() => setLead(!lead())}>
        Switch lead
      </button>
      <button type="button" onClick={() => setGuest(!guest())}>
        Toggle guest
      </button>
      <ul>
        <KeyedFor each={props.ids} by={(id) => id}>
          {(id) => <Member id={id.value} />}
        </KeyedFor>
        <Show when={lead()} fallback={<Member id="linus" />}>
          <Member id="ada" />
        </Show>
        <Show when={guest()}>
          <Member id="hopper" />
        </Show>
      </ul>
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
