import type { ComponentProps, JSX } from "@solidjs/web";
import { createSignal, getObserver, omit } from "solid-js";

export interface StepperModels {
  value?: number;
  onValueChange?: (value: number) => void;
}

export default function Stepper(
  props: { label: string } & StepperModels &
    Omit<ComponentProps<"div">, "label" | "value" | "class" | "style"> & {
      class?: string;
      style?: JSX.CSSProperties;
    },
) {
  const others = omit(props, "label", "value", "onValueChange", "class");

  const [localValue, setLocalValue] = createState<number>(0);
  const value = () => (props.value === undefined ? localValue() : props.value);

  function setValue(next: number) {
    setLocalValue(next);
    props.onValueChange?.(next);
  }

  return (
    <div class={props.class ? `stepper ${props.class}` : "stepper"} {...others}>
      <button
        type="button"
        aria-label={`Fewer ${props.label}`}
        onClick={() => setValue(value() - 1)}
      >
        -
      </button>
      <span>
        {props.label}: {value()}
      </span>
      <button
        type="button"
        aria-label={`More ${props.label}`}
        onClick={() => setValue(value() + 1)}
      >
        +
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
