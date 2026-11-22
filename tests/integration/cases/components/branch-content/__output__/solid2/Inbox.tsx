import Notice from "./Notice";
import type { ComponentProps, JSX } from "@solidjs/web";
import { Show, createSignal, getObserver, omit, untrack } from "solid-js";

export default function Inbox(
  props: { unread: number } & Omit<ComponentProps<"div">, "unread" | "class" | "style"> & {
      class?: string;
      style?: JSX.CSSProperties;
    },
) {
  const others = omit(props, "unread", "class");

  const [count, setCount] = createState(untrack(() => props.unread));

  return (
    <div class={props.class ? `inbox ${props.class}` : "inbox"} {...others}>
      <Show when={count() > 0} fallback={<Notice text="All read" tone="quiet" />}>
        <Notice text={`${count()} unread`} tone="info" />
      </Show>
      <button type="button" onClick={() => setCount(0)}>
        Mark all read
      </button>
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
