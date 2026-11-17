import type { JSX } from "@solidjs/web";
import { For, Show, createMemo, createSignal, getObserver, onCleanup, untrack } from "solid-js";

export interface TagFormEvents {
  onTagsChange?: (tags: string[]) => void;
}

function blockComma(event: KeyboardEvent) {
  if (event.key === ",") event.preventDefault();
}

export default function TagForm(
  props: TagFormEvents & { class?: string; style?: JSX.CSSProperties },
) {
  const [tags, setTags] = createState<string[]>([]);
  const [draft, setDraft] = createState("");
  const [helpOpen, setHelpOpen] = createState(false);
  let field: HTMLInputElement | null = null;

  function updateDraft(event: InputEvent) {
    setDraft((event.currentTarget as HTMLInputElement).value);
  }

  function addTag(event: SubmitEvent) {
    event.preventDefault();
    if (draft() !== "" && !tags().includes(draft())) {
      setTags([...tags(), draft()]);
      props.onTagsChange?.(tags());
    }
    setDraft("");
    const input = field;
    if (input) input.value = "";
  }

  function toggleHelp(event: MouseEvent) {
    event.preventDefault();
    setHelpOpen(!helpOpen());
  }

  return (
    <form
      class={props.class ? `tag-form ${props.class}` : "tag-form"}
      aria-label="Tags"
      onSubmit={addTag}
      style={props.style}
      {...scopeAttributes(props)}
    >
      <label>
        New tag
        <input
          name="tag"
          ref={clearedRef(
            (element) => {
              field = element;
            },
            () => {
              field = null;
            },
          )}
          onKeyDown={blockComma}
          onInput={updateDraft}
        />
      </label>
      <button type="submit">Add tag</button>
      <a href="/help/tags" onClick={toggleHelp}>
        How tags work
      </a>
      <Show when={helpOpen()}>
        <p>A tag is one word: commas are not allowed.</p>
      </Show>
      <ul aria-label="Added tags">
        <KeyedFor each={tags()} by={(tag) => tag}>
          {(tag) => <li>{tag.value}</li>}
        </KeyedFor>
      </ul>
    </form>
  );
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
}

/** A list whose rows follow their keys, so a row keeps its element while the list reorders and while its item is replaced. */
function KeyedFor<T>(props: {
  each: readonly T[];
  by: (item: T, index: number) => unknown;
  children: (row: { readonly value: T; readonly index: number }) => JSX.Element;
}): JSX.Element {
  const items = createMemo(() => {
    const rows = new Map<unknown, T>();
    props.each.forEach((item, index) => {
      const key = props.by(item, index);
      rows.set(rows.has(key) ? {} : key, item);
    });
    return rows;
  });
  return (
    <For each={[...items().keys()]}>
      {(key, index) => {
        const item = createMemo(() => items().get(key) as T);
        return untrack(() =>
          props.children({
            get value() {
              return item();
            },
            get index() {
              return index();
            },
          }),
        );
      }}
    </For>
  );
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
