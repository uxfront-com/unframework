import type { JSX } from "@solidjs/web";
import { Show, createSignal, getObserver } from "solid-js";

export interface ChoiceSlots {
  body?: JSX.Element;
}

export default function Choice(props: ChoiceSlots & { class?: string; style?: JSX.CSSProperties }) {
  const [first, setFirst] = createState(true);

  return (
    <div
      class={props.class ? `choice ${props.class}` : "choice"}
      style={props.style}
      {...scopeAttributes(props)}
    >
      <Show when={first()} fallback={<i>{props.body}</i>}>
        <b>{props.body}</b>
      </Show>
      <button type="button" onClick={() => setFirst(!first())}>
        Switch
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
