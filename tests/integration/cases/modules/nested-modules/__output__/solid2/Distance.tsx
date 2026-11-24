import { formatDistance } from "./format";
import type { Unit } from "./units";
import type { ComponentProps, JSX } from "@solidjs/web";
import { createSignal, getObserver, omit } from "solid-js";

export default function Distance(
  props: { value: number } & Omit<ComponentProps<"section">, "value" | "class" | "style"> & {
      class?: string;
      style?: JSX.CSSProperties;
    },
) {
  const others = omit(props, "value", "class");

  const [unit, setUnit] = createState<Unit>("km");

  return (
    <section
      class={props.class ? `distance ${props.class}` : "distance"}
      aria-label="Distance"
      {...others}
    >
      <p role="status">{formatDistance(props.value, unit())}</p>
      <button type="button" onClick={() => setUnit(unit() === "km" ? "mi" : "km")}>
        Switch units
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
