import Card from "./Card";
import Chip from "./Chip";
import { type ComponentProps, Dynamic, type JSX } from "@solidjs/web";
import { createSignal, getObserver, omit } from "solid-js";

export default function Tag(
  props: { label: string } & Omit<ComponentProps<"section">, "label" | "class" | "style"> & {
      class?: string;
      style?: JSX.CSSProperties;
    },
) {
  const others = omit(props, "label");

  const [compact, setCompact] = createState(true);

  return (
    <section aria-label="Tag" {...others}>
      <Dynamic component={compact() ? Chip : Card} label={props.label} />
      <button type="button" onClick={() => setCompact(!compact())}>
        {compact() ? "Expand" : "Compact"}
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
