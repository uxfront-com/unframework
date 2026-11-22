import type { ComponentProps, JSX } from "@solidjs/web";
import { Show, createSignal, getObserver, merge, omit, untrack } from "solid-js";

export interface CounterProps {
  initial?: number;
  step?: number;
}

export interface CounterEvents {
  onChange?: (value: number) => void;
}

export default function Counter(
  rawProps: CounterProps &
    CounterEvents &
    Omit<ComponentProps<"div">, "initial" | "step" | "onChange" | "class" | "style"> & {
      class?: string;
      style?: JSX.CSSProperties;
    },
) {
  const props = merge(rawProps, {
    get initial() {
      return rawProps.initial === undefined ? 0 : rawProps.initial;
    },
    get step() {
      return rawProps.step === undefined ? 1 : rawProps.step;
    },
  });
  const others = omit(props, "initial", "step", "onChange", "class");

  const [count, setCount] = createState(untrack(() => props.initial));
  const doubled = () => count() * 2;

  function increment() {
    setCount(count() + props.step);
    props.onChange?.(count());
  }

  return (
    <div class={props.class ? `counter ${props.class}` : "counter"} {...others}>
      <output>{count()}</output>
      <Show when={doubled() > 10}>
        <span>Big</span>
      </Show>
      <button type="button" onClick={increment}>
        +{props.step}
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
