import type { JSX } from "@solidjs/web";
import { createSignal, getObserver } from "solid-js";

export interface PriceRangeModels {
  min?: number;
  onMinChange?: (value: number) => void;
  max?: number;
  onMaxChange?: (value: number) => void;
}

export default function PriceRange(
  props: { label: string } & PriceRangeModels & { class?: string; style?: JSX.CSSProperties },
) {
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
    <fieldset class={props.class} style={props.style} {...scopeAttributes(props)}>
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

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
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
