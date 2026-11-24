import type { ComponentProps, JSX } from "@solidjs/web";
import { For, createMemo, createSignal, getObserver, omit, untrack } from "solid-js";

export default function ListenerOrder(
  props: Omit<ComponentProps<"section">, "class" | "style"> & {
    class?: string;
    style?: JSX.CSSProperties;
  },
) {
  const others = omit(props, "class");

  const [log, setLog] = createState<string[]>([]);
  const [resets, setResets] = createState(0);

  function record(line: string) {
    setLog([...log(), line]);
  }

  return (
    <section
      class={props.class ? `listener-order ${props.class}` : "listener-order"}
      aria-label="Listener order"
      {...others}
    >
      <div
        class="toolbar"
        role="presentation"
        ref={(element) => element.addEventListener("click", () => record("toolbar"))}
      >
        <button
          type="button"
          ref={(element) => {
            element.addEventListener("click", () => record("save"));
            element.addEventListener("click", () => record("first save"), { once: true });
          }}
        >
          Save
        </button>
        <button
          type="button"
          ref={(element) => {
            element.addEventListener("click", () => record("first send"), { once: true });
            element.addEventListener("click", () => record("send"));
          }}
        >
          Send
        </button>
        <button
          type="button"
          ref={(element) => {
            element.addEventListener("click", () => record("reset"));
            element.addEventListener("click", () => setResets(resets() + 1), { once: true });
          }}
        >
          Reset
        </button>
      </div>
      <div
        class="panel"
        role="presentation"
        ref={(element) => {
          element.addEventListener("click", () => record("panel capture"), { capture: true });
          element.addEventListener("click", (event) => {
            event.stopPropagation();
            record("panel bubble");
          });
        }}
      >
        <button
          type="button"
          ref={(element) => element.addEventListener("click", () => record("inside"))}
        >
          Inside
        </button>
      </div>
      <button
        type="button"
        ref={(element) => element.addEventListener("click", () => record("outside"))}
      >
        Outside
      </button>
      <div
        class="claim"
        role="presentation"
        ref={(element) =>
          element.addEventListener("click", () => record("claim once"), { once: true })
        }
      >
        <button
          type="button"
          ref={(element) =>
            element.addEventListener("click", (event) => {
              event.stopPropagation();
              record("stopped");
            })
          }
        >
          Stop
        </button>
        <button
          type="button"
          ref={(element) => element.addEventListener("click", () => record("pass"))}
        >
          Pass
        </button>
      </div>
      <div
        class="outer-zone"
        role="group"
        aria-label="Outer zone"
        onWheel={() => record("outer wheel")}
      >
        <div
          class="inner-zone"
          role="group"
          aria-label="Inner zone"
          ref={(element) =>
            element.addEventListener("wheel", () => record("inner wheel"), { passive: true })
          }
        >
          Scroll here
        </div>
      </div>
      <p>Resets: {resets()}</p>
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
