import type { ComponentProps, JSX } from "@solidjs/web";
import { For, createMemo, createSignal, getObserver, omit, untrack } from "solid-js";

export default function EventLog(
  props: Omit<ComponentProps<"section">, "class" | "style"> & {
    class?: string;
    style?: JSX.CSSProperties;
  },
) {
  const others = omit(props, "class");

  const [log, setLog] = createState<string[]>([]);
  const [volume, setVolume] = createState(5);

  function record(line: string) {
    setLog([...log(), line]);
  }

  function changeVolume(event: WheelEvent) {
    if (event.deltaY < 0) {
      setVolume(volume() + 1);
    } else {
      setVolume(volume() - 1);
    }
  }

  return (
    <section
      class={props.class ? `event-log ${props.class}` : "event-log"}
      aria-label="Event options"
      {...others}
    >
      <div
        class="panel"
        role="presentation"
        ref={(element) => {
          element.addEventListener("click", () => record("panel capture"), { capture: true });
          element.addEventListener("click", () => record("panel bubble"));
        }}
      >
        <button
          type="button"
          ref={(element) => element.addEventListener("click", () => record("button"))}
        >
          Inside
        </button>
        <button
          type="button"
          ref={(element) =>
            element.addEventListener("click", (event) => {
              event.stopPropagation();
              record("stopped");
            })
          }
        >
          Stop here
        </button>
      </div>
      <button
        type="button"
        ref={(element) => element.addEventListener("click", () => record("once"), { once: true })}
      >
        Only once
      </button>
      <div
        class="reward"
        role="presentation"
        ref={(element) => element.addEventListener("click", () => record("outer"))}
      >
        <button
          type="button"
          ref={(element) =>
            element.addEventListener(
              "click",
              (event) => {
                event.stopPropagation();
                record("claimed");
              },
              { once: true },
            )
          }
        >
          Claim the reward
        </button>
      </div>
      <div
        class="volume"
        role="group"
        aria-label="Volume"
        ref={(element) => element.addEventListener("wheel", changeVolume, { passive: true })}
      >
        <output>{volume()}</output>
      </div>
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
