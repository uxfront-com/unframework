import Choice from "./Choice";
import List from "./List";
import Wrapper from "./Wrapper";
import { vTrace } from "./vTrace";
import type { ComponentProps, JSX } from "@solidjs/web";
import { createSignal, getObserver, omit, onCleanup } from "solid-js";

export default function Page(
  props: Omit<ComponentProps<"section">, "class" | "style"> & {
    class?: string;
    style?: JSX.CSSProperties;
  },
) {
  const others = omit(props, "class");

  const [label, setLabel] = createState("first");
  let note: HTMLParagraphElement | null = null;
  const [noted, setNoted] = createState("");

  return (
    <section class={props.class ? `page ${props.class}` : "page"} aria-label="Page" {...others}>
      <Wrapper
        row={
          <span data-name="row" ref={vTrace(() => label())}>
            Row
          </span>
        }
      />
      <Choice
        body={
          <em data-name="body" ref={vTrace(() => label())}>
            Body
          </em>
        }
      />
      <List
        items={["a", "b"]}
        item={({ item }) => (
          <strong data-name="item" ref={vTrace(() => label())}>
            {item}
          </strong>
        )}
      />
      <p
        ref={[
          clearedRef(
            (element) => {
              note = element;
            },
            () => {
              note = null;
            },
          ),
          vTrace(() => label()),
        ]}
        data-name="note"
      >
        Note
      </p>
      <output>{noted()}</output>
      <button type="button" onClick={() => setNoted(note?.getAttribute("data-name") ?? "")}>
        Check
      </button>
      <button type="button" onClick={() => setLabel("second")}>
        Rename
      </button>
    </section>
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
