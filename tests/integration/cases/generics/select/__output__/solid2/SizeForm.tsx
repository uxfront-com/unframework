import Select from "./Select";
import type { ComponentProps, JSX } from "@solidjs/web";
import { createSignal, getObserver } from "solid-js";

type Size = "s" | "m" | "l";

const sizes: Size[] = ["s", "m", "l"];

export default function SizeForm(
  props: Omit<ComponentProps<"section">, "class" | "style"> & {
    class?: string;
    style?: JSX.CSSProperties;
  },
) {
  const [size, setSize] = createState<Size>("m");

  return (
    <section aria-label="Size" {...props}>
      <Select label="Size" options={sizes} value={size()} onValueChange={setSize} />
      <output>Chosen: {size()}</output>
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
