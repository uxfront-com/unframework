import type { ComponentProps, JSX } from "@solidjs/web";
import { createSignal, getObserver, merge, omit, untrack } from "solid-js";

export interface StepperProps {
  start?: number;
}

export interface StepperEvents {
  onChange?: (value: number) => void;
}

export default function Stepper(
  rawProps: StepperProps &
    StepperEvents &
    Omit<ComponentProps<"div">, "start" | "onChange" | "class" | "style"> & {
      class?: string;
      style?: JSX.CSSProperties;
    },
) {
  const props = merge(rawProps, {
    get start() {
      return rawProps.start === undefined ? 0 : rawProps.start;
    },
  });
  const others = omit(props, "start", "onChange", "class");

  const [count, setCount] = createState(untrack(() => props.start));

  function add() {
    setCount(count() + 1);
    props.onChange?.(count());
  }

  return (
    <div class={props.class ? `stepper ${props.class}` : "stepper"} {...others}>
      <output>{count()}</output>
      <button type="button" onClick={add}>
        Add one
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
