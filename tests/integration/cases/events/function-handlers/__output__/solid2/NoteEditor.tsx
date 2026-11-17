import type { JSX } from "@solidjs/web";
import { createSignal, getObserver, onCleanup } from "solid-js";

export interface NoteEditorEvents {
  onSaved?: (count: number) => void;
  onTagged?: (tag: string, via: string) => void;
}

export default function NoteEditor(
  props: NoteEditorEvents & { class?: string; style?: JSX.CSSProperties },
) {
  const [saves, setSaves] = createState(0);
  const [lastKey, setLastKey] = createState("none");
  const [tags, setTags] = createState<string[]>([]);
  const [tag, setTag] = createState("");
  let tagField: HTMLInputElement | null = null;

  function save() {
    setSaves(saves() + 1);
    props.onSaved?.(saves());
  }

  function recordKey(event: KeyboardEvent) {
    setLastKey(event.key);
  }

  function addTag(event: MouseEvent | KeyboardEvent) {
    if (tag() === "") return;
    setTags([...tags(), tag()]);
    props.onTagged?.(tag(), event.type);
    setTag("");
    if (tagField) tagField.value = "";
  }

  function onTagKeydown(event: KeyboardEvent) {
    if (event.key === "Enter") addTag(event);
  }

  return (
    <section
      class={props.class ? `note-editor ${props.class}` : "note-editor"}
      aria-label="Note"
      style={props.style}
      {...scopeAttributes(props)}
    >
      <button type="button" onClick={save}>
        Save
      </button>
      <label>
        Title
        <input name="title" onKeyDown={recordKey} />
      </label>
      <label>
        Body
        <textarea name="body" onKeyDown={recordKey} />
      </label>
      <p role="status">
        Saved {saves()} times, last key {lastKey()}
      </p>
      <button type="button" onClick={save}>
        Save and close
      </button>
      <label>
        Tag
        <input
          ref={clearedRef(
            (element) => {
              tagField = element;
            },
            () => {
              tagField = null;
            },
          )}
          name="tag"
          onInput={(event) => setTag((event.currentTarget as HTMLInputElement).value)}
          onKeyDown={onTagKeydown}
        />
      </label>
      <button type="button" onClick={addTag}>
        Add tag
      </button>
      <p>Tags: {tags().join(", ")}</p>
    </section>
  );
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
}

/** A `ref` that calls `callback` with its element, and `clear` once the element is removed. */
function clearedRef<T>(callback: (element: T) => void, clear: () => void): (element: T) => void {
  onCleanup(clear);
  return callback;
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
