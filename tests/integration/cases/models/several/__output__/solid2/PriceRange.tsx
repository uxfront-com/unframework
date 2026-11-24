import type { ComponentProps, JSX } from "@solidjs/web";
import { createSignal, getObserver, omit } from "solid-js";

export interface PriceRangeModels {
  min?: number;
  onMinChange?: (value: number) => void;
  max?: number;
  onMaxChange?: (value: number) => void;
}

export default function PriceRange(
  props: { label: string } & PriceRangeModels &
    Omit<ComponentProps<"fieldset">, "label" | "min" | "max" | "class" | "style"> & {
      class?: string;
      style?: JSX.CSSProperties;
    },
) {
  const others = omit(props, "label", "min", "onMinChange", "max", "onMaxChange");

  const [localMin, setLocalMin] = createState<number>(0);
  const min = () => (props.min === undefined ? localMin() : props.min);

  function setMin(next: number) {
    setLocalMin(next);
    props.onMinChange?.(next);
  }

  const [localMax, setLocalMax] = createState<number>(100);
  const max = () => (props.max === undefined ? localMax() : props.max);

  function setMax(next: number) {
    setLocalMax(next);
    props.onMaxChange?.(next);
  }

  function widen() {
    setMin(min() - 10);
    setMax(max() + 10);
  }

  return (
    <fieldset {...others}>
      <legend>{props.label}</legend>
      <p>
        From {min()} to {max()}
      </p>
      <button type="button" onClick={widen}>
        Widen
      </button>
    </fieldset>
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
