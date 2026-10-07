import { $, type QRL, component$, useSignal } from "@qwik.dev/core";

export interface NoteEditorEvents {
  onSaved$?: QRL<(count: number) => void>;
  onTagged$?: QRL<(tag: string, via: string) => void>;
}

export default component$<NoteEditorEvents>(({ onSaved$, onTagged$ }) => {
  const saves = useSignal(0);
  const lastKey = useSignal("none");
  const tags = useSignal<string[]>([]);
  const tag = useSignal("");
  const tagField = useSignal<HTMLInputElement>();

  const save = $(() => {
    saves.value += 1;
    onSaved$?.(saves.value);
  });

  const recordKey = $((event: KeyboardEvent) => {
    lastKey.value = event.key;
  });

  const addTag = $((event: MouseEvent | KeyboardEvent) => {
    if (tag.value === "") return;
    tags.value = [...tags.value, tag.value];
    onTagged$?.(tag.value, event.type);
    tag.value = "";
    if (tagField.value) tagField.value.value = "";
  });

  const onTagKeydown = $(async (event: KeyboardEvent) => {
    if (event.key === "Enter") await addTag(event);
  });

  return (
    <section class="note-editor" aria-label="Note">
      <button type="button" onClick$={save}>
        Save
      </button>
      <label>
        Title
        <input name="title" onKeyDown$={recordKey} />
      </label>
      <label>
        Body
        <textarea name="body" onKeyDown$={recordKey} />
      </label>
      <p role="status">
        Saved {saves.value} times, last key {lastKey.value}
      </p>
      <button type="button" onClick$={save}>
        Save and close
      </button>
      <label>
        Tag
        <input
          ref={tagField}
          name="tag"
          onInput$={(_, element) => (tag.value = (element as HTMLInputElement).value)}
          onKeyDown$={onTagKeydown}
        />
      </label>
      <button type="button" onClick$={addTag}>
        Add tag
      </button>
      <p>Tags: {tags.value.join(", ")}</p>
    </section>
  );
});
