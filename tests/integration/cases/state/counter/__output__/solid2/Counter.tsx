import type { JSX } from "@solidjs/web";
import { Show, createSignal, getObserver, merge, untrack } from "solid-js";

export interface CounterProps {
  initial?: number;
  step?: number;
}

export interface CounterEvents {
  onChange?: (value: number) => void;
}

export default function Counter(
  rawProps: CounterProps & CounterEvents & { class?: string; style?: JSX.CSSProperties },
) {
  const props = merge(rawProps, {
    get initial() {
      return rawProps.initial === undefined ? 0 : rawProps.initial;
    },
    get step() {
      return rawProps.step === undefined ? 1 : rawProps.step;
    },
  });
  const [count, setCount] = createState(untrack(() => props.initial));
  const doubled = () => count() * 2;

  function increment() {
    setCount(count() + props.step);
    props.onChange?.(count());
  }

  return (
    <div
      class={props.class ? `counter ${props.class}` : "counter"}
      style={props.style}
      {...scopeAttributes(props)}
    >
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
