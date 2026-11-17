import type { JSX } from "@solidjs/web";
import { createSignal, getObserver } from "solid-js";

import { TickChild } from "./TickChild";

export interface TickParentEvents {
  onChecked?: (seen: number) => void;
}

export default function TickParent(
  props: TickParentEvents & { class?: string; style?: JSX.CSSProperties },
) {
  const [count, setCount] = createState(0);
  const [seen, setSeen] = createState(0);

  async function bump() {
    setCount(count() + 1);
    await nextTick();
    props.onChecked?.(seen());
  }

  return (
    <div class={props.class} style={props.style} {...scopeAttributes(props)}>
      <TickChild count={count()} onSeen={(value: number) => setSeen(value)} />
      <button type="button" onClick={bump}>
        Bump
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
 * Resolves once the DOM has updated and the watchers have run: Solid applies writes on a microtask
 * queued at the first write, which queues the watchers of a write the component didn't make.
 */
function nextTick(): Promise<void> {
  return new Promise((resolve) => queueMicrotask(() => queueMicrotask(resolve)));
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
