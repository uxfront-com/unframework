import type { JSX } from "@solidjs/web";
import { createSignal, getObserver, onSettled } from "solid-js";

export interface DraftEditorEvents {
  onSaved?: (count: number) => void;
}

export default function DraftEditor(
  props: DraftEditorEvents & { class?: string; style?: JSX.CSSProperties },
) {
  const [saves, setSaves] = createState(0);

  function onShortcut(event: KeyboardEvent) {
    if (event.key !== "s" || !event.ctrlKey) return;
    event.preventDefault();
    setSaves(saves() + 1);
    props.onSaved?.(saves());
  }

  onSettled(() => {
    document.addEventListener("keydown", onShortcut);
  });

  onSettled(() => () => {
    document.removeEventListener("keydown", onShortcut);
  });

  return (
    <section
      class={props.class ? `draft-editor ${props.class}` : "draft-editor"}
      aria-label="Draft"
      style={props.style}
      {...scopeAttributes(props)}
    >
      <label>
        Draft
        <textarea name="draft" />
      </label>
      <p role="status">Saved: {saves()}</p>
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
