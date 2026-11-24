import type { ComponentProps, JSX } from "@solidjs/web";
import { createSignal, getObserver, omit } from "solid-js";

export interface SaveDraftEvents {
  onSaved?: (attempt: number, status: string) => void;
}

export default function SaveDraft(
  props: SaveDraftEvents &
    Omit<ComponentProps<"section">, "class" | "style"> & {
      class?: string;
      style?: JSX.CSSProperties;
    },
) {
  const others = omit(props, "onSaved", "class");

  const [status, setStatus] = createState("Not saved");
  const [attempts, setAttempts] = createState(0);

  async function save() {
    setStatus("Saving");
    setAttempts(attempts() + 1);
    await Promise.resolve();
    setStatus("Checking");
    await nextTick();
    setStatus(`Saved, attempt ${attempts()}`);
    props.onSaved?.(attempts(), status());
  }

  return (
    <section
      class={props.class ? `save-draft ${props.class}` : "save-draft"}
      aria-label="Draft"
      {...others}
    >
      <p role="status">{status()}</p>
      <button type="button" onClick={save}>
        Save the draft
      </button>
    </section>
  );
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
