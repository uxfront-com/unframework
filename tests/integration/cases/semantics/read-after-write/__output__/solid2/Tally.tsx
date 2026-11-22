import type { ComponentProps, JSX } from "@solidjs/web";
import { createSignal, getObserver, omit } from "solid-js";

export interface TallyEvents {
  onTotal?: (value: number) => void;
  onSteps?: (values: number[]) => void;
  onLogged?: (entries: string[]) => void;
}

export default function Tally(
  props: TallyEvents &
    Omit<ComponentProps<"section">, "class" | "style"> & {
      class?: string;
      style?: JSX.CSSProperties;
    },
) {
  const others = omit(props, "onTotal", "onSteps", "onLogged", "class");

  const [count, setCount] = createState(0);
  const [trail, setTrail] = createState<string[]>([]);

  function addTwice() {
    setCount(count() + 1);
    setCount(count() + 1);
    props.onTotal?.(count());
  }

  function addFive() {
    setCount(count() + 5);
    props.onTotal?.(count());
  }

  function countUp() {
    const seen: number[] = [];
    for (let step = 0; step < 3; step++) {
      setCount(count() + 1);
      seen.push(count());
    }
    props.onSteps?.(seen);
  }

  function addTen() {
    setCount(count() + 10);
  }

  function addTenAndReport() {
    addTen();
    props.onTotal?.(count());
  }

  function logCapture() {
    setTrail([...trail(), "capture"]);
  }

  function logBubble() {
    setTrail([...trail(), "bubble"]);
    props.onLogged?.(trail());
  }

  return (
    <section class={props.class ? `tally ${props.class}` : "tally"} aria-label="Tally" {...others}>
      <p role="status">Count: {count()}</p>
      <button type="button" onClick={addTwice}>
        Add two
      </button>
      <button type="button" onClick={addFive}>
        Add five
      </button>
      <button type="button" onClick={countUp}>
        Count up three
      </button>
      <button type="button" onClick={addTenAndReport}>
        Add ten
      </button>
      <button
        type="button"
        ref={(element) => element.addEventListener("click", logCapture, { capture: true })}
        onClick={logBubble}
      >
        Log the phases
      </button>
      <p>Phases: {trail().join(" then ")}</p>
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
