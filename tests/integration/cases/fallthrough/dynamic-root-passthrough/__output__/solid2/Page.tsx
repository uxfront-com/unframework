import Base from "./Base";
import Primary from "./Primary";
import type { ComponentProps, JSX } from "@solidjs/web";
import { For, createMemo, createSignal, getObserver, onCleanup, untrack } from "solid-js";

export default function Page(
  props: Omit<ComponentProps<"section">, "class" | "style"> & {
    class?: string;
    style?: JSX.CSSProperties;
  },
) {
  const [linked, setLinked] = createState(true);
  const [log, setLog] = createState<string[]>([]);
  let direct: HTMLAnchorElement | HTMLButtonElement | null = null;
  let chained: HTMLAnchorElement | HTMLButtonElement | null = null;

  function record(line: string) {
    setLog([...log(), line]);
  }

  return (
    <section aria-label="Page" {...props}>
      <Base
        href={linked() ? "#direct" : undefined}
        text="Direct"
        id="direct"
        aria-label="Direct"
        data-testid="direct"
        title="Go"
        onClick={(event) => record(`click on ${(event.currentTarget as Element).localName}`)}
        onKeyDown={(event) =>
          record(`keydown ${event.key} on ${(event.currentTarget as Element).localName}`)
        }
        ref={clearedRef(
          (element) => {
            direct = element;
          },
          () => {
            direct = null;
          },
        )}
      />
      <Primary
        href={linked() ? "#chained" : undefined}
        text="Chained"
        id="chained"
        aria-label="Chained"
        data-testid="chained"
        onClick={(event) => record(`chained on ${(event.currentTarget as Element).localName}`)}
        ref={clearedRef(
          (element) => {
            chained = element;
          },
          () => {
            chained = null;
          },
        )}
      />
      <button type="button" onClick={() => setLinked(!linked())}>
        Toggle
      </button>
      <button type="button" onClick={() => direct?.focus()}>
        Focus direct
      </button>
      <button type="button" onClick={() => chained?.focus()}>
        Focus chained
      </button>
      <ol aria-label="Log">
        <KeyedFor each={log()} by={(entry, index) => index}>
          {(entry) => <li>{entry.value}</li>}
        </KeyedFor>
      </ol>
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
