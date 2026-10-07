import { createSignal, onCleanup } from "solid-js";

export interface NoteEditorEvents {
  onSaved?: (count: number) => void;
  onTagged?: (tag: string, via: string) => void;
}

export default function NoteEditor(props: NoteEditorEvents) {
  const [saves, setSaves] = createSignal(0);
  const [lastKey, setLastKey] = createSignal("none");
  const [tags, setTags] = createSignal<string[]>([]);
  const [tag, setTag] = createSignal("");
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
    <section class="note-editor" aria-label="Note">
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
          ref={(element) => {
            tagField = element;
            onCleanup(() => {
              tagField = null;
            });
          }}
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
