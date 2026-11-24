import Panel from "./Panel";
import type { ComponentProps, JSX } from "@solidjs/web";
import { Show, createSignal, getObserver, omit } from "solid-js";

export default function Board(
  props: Omit<ComponentProps<"div">, "class" | "style"> & {
    class?: string;
    style?: JSX.CSSProperties;
  },
) {
  const others = omit(props, "class");

  const [showA, setShowA] = createState(true);
  const [showB, setShowB] = createState(true);
  const [entries, setEntries] = createState<string[]>([]);

  function record(entry: string) {
    setEntries([...entries(), entry]);
  }

  return (
    <div class={props.class ? `board ${props.class}` : "board"} {...others}>
      <Show when={showA()}>
        <Panel name="a" onClosed={record} />
      </Show>
      <Show when={showB()}>
        <Panel name="b" onClosed={record} />
      </Show>
      <button type="button" onClick={() => setShowA(false)}>
        Hide a
      </button>
      <button type="button" onClick={() => setShowB(false)}>
        Hide b
      </button>
      <output>{entries().join(", ")}</output>
    </div>
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
