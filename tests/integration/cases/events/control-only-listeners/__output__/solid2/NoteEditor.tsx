import type { JSX } from "@solidjs/web";
import { createSignal, getObserver } from "solid-js";

export interface NoteEditorEvents {
  onSaved?: (title: string, bold: boolean) => void;
}

export default function NoteEditor(
  props: NoteEditorEvents & { class?: string; style?: JSX.CSSProperties },
) {
  const [title, setTitle] = createState("");
  const [bold, setBold] = createState(false);
  const [saves, setSaves] = createState(0);

  function save() {
    setSaves(saves() + 1);
    props.onSaved?.(title(), bold());
  }

  return (
    <form
      class={props.class ? `note-editor ${props.class}` : "note-editor"}
      aria-label="Note"
      onSubmit={(event) => event.preventDefault()}
      style={props.style}
      {...scopeAttributes(props)}
    >
      <label>
        Title
        <input
          name="title"
          onInput={(event) => setTitle((event.currentTarget as HTMLInputElement).value)}
        />
      </label>
      <label>
        Text
        <textarea name="text" />
      </label>
      <div class="format" role="group" aria-label="Format">
        <button
          type="button"
          aria-pressed={enumeratedValue(bold())}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => setBold(!bold())}
        >
          Bold
        </button>
      </div>
      <button type="submit" onClick={save}>
        Save
      </button>
      <p role="status">Saves: {saves()}</p>
    </form>
  );
}

/** An enumerated attribute's value: a boolean as `"true"` or `"false"`, as Vue writes it. */
function enumeratedValue<T>(value: T): T extends boolean ? `${T}` : T {
  return (typeof value === "boolean" ? String(value) : value) as T extends boolean ? `${T}` : T;
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
