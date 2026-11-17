import type { JSX } from "@solidjs/web";
import { createSignal, getObserver } from "solid-js";

export default function NoteEditor(props: { class?: string; style?: JSX.CSSProperties }) {
  const [note, setNote] = createState("Buy milk");

  return (
    <section aria-label="Note" class={props.class} style={props.style} {...scopeAttributes(props)}>
      <textarea
        aria-label="Text"
        value={note()}
        onInput={(event) => setNote(event.currentTarget.value)}
        ref={textCaret}
      />
      <output>{note().length} characters</output>
      <button type="button" onClick={() => setNote("")}>
        Discard
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

/** Puts a field's caret after its text, as setting the text of an empty field leaves it. */
function textCaret(field: HTMLTextAreaElement) {
  const text = field.value;
  field.value = "";
  field.value = text;
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
