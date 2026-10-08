import { defineEmits, ref, useTemplateRef } from "unframework";

export default function NoteEditor() {
  const emit = defineEmits<{ saved: [count: number]; tagged: [tag: string, via: string] }>();

  const saves = ref(0);
  const lastKey = ref("none");
  const tags = ref<string[]>([]);
  const tag = ref("");
  const tagField = useTemplateRef<HTMLInputElement>();

  function save() {
    saves.value += 1;
    emit("saved", saves.value);
  }

  function recordKey(event: KeyboardEvent) {
    lastKey.value = event.key;
  }

  function addTag(event: MouseEvent | KeyboardEvent) {
    if (tag.value === "") return;
    tags.value = [...tags.value, tag.value];
    emit("tagged", tag.value, event.type);
    tag.value = "";
    if (tagField.value) tagField.value.value = "";
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
        <input name="title" onKeydown={recordKey} />
      </label>
      <label>
        Body
        <textarea name="body" onKeydown={recordKey} />
      </label>
      <p role="status">
        Saved {saves.value} times, last key {lastKey.value}
      </p>
      <button type="button" onClick={save}>
        Save and close
      </button>
      <label>
        Tag
        <input
          ref={tagField}
          name="tag"
          onInput={(event) => (tag.value = (event.currentTarget as HTMLInputElement).value)}
          onKeydown={onTagKeydown}
        />
      </label>
      <button type="button" onClick={addTag}>
        Add tag
      </button>
      <p>Tags: {tags.value.join(", ")}</p>
    </section>
  );
}
