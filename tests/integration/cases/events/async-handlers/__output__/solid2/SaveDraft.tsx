import type { JSX } from "@solidjs/web";
import { createSignal, getObserver } from "solid-js";

export interface SaveDraftEvents {
  onSaved?: (attempt: number, status: string) => void;
}

export default function SaveDraft(
  props: SaveDraftEvents & { class?: string; style?: JSX.CSSProperties },
) {
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
      style={props.style}
      {...scopeAttributes(props)}
    >
      <p role="status">{status()}</p>
      <button type="button" onClick={save}>
        Save the draft
      </button>
    </section>
  );
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
}

/**
 * Resolves once the DOM has updated and the watchers have run: Solid applies writes as it makes
 * them, and the watchers run in a microtask queued at the first write, before this one.
 */
function nextTick(): Promise<void> {
  return Promise.resolve();
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
