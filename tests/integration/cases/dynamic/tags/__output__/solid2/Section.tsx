import { type ComponentProps, Dynamic, type JSX } from "@solidjs/web";
import { createSignal, getObserver, omit } from "solid-js";

export default function Section(
  props: { title: string } & Omit<ComponentProps<"article">, "title" | "class" | "style"> & {
      class?: string;
      style?: JSX.CSSProperties;
    },
) {
  const others = omit(props, "title");

  const [nested, setNested] = createState(false);

  return (
    <article {...others}>
      <Dynamic component={nested() ? "h3" : "h2"} class="title">
        {props.title}
      </Dynamic>
      <button type="button" onClick={() => setNested(!nested())}>
        {nested() ? "Lift" : "Nest"}
      </button>
    </article>
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
