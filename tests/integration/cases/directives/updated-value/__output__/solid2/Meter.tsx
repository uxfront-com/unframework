import { vRecord } from "./vRecord";
import type { ComponentProps, JSX } from "@solidjs/web";
import { createSignal, getObserver, omit } from "solid-js";

export default function Meter(
  props: Omit<ComponentProps<"section">, "class" | "style"> & {
    class?: string;
    style?: JSX.CSSProperties;
  },
) {
  const others = omit(props, "class");

  const [level, setLevel] = createState(1);
  const [renders, setRenders] = createState(0);

  return (
    <section class={props.class ? `meter ${props.class}` : "meter"} aria-label="Meter" {...others}>
      <output class="level" ref={vRecord(() => level())}>
        Level {level()}
      </output>
      <p>Rendered again {renders()} times</p>
      <button type="button" onClick={() => setLevel(level() + 1)}>
        Raise
      </button>
      <button type="button" onClick={() => setRenders(renders() + 1)}>
        Render again
      </button>
    </section>
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
