import {
  $,
  type CSSProperties,
  type ClassList,
  type QRL,
  component$,
  useSignal,
} from "@qwik.dev/core";

export interface NoteEditorEvents {
  onSaved$?: QRL<(count: number) => void>;
  onTagged$?: QRL<(tag: string, via: string) => void>;
}

export default component$<NoteEditorEvents & { class?: ClassList; style?: CSSProperties }>(
  ({ onSaved$, onTagged$, class: className, style, ...attributes }) => {
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
      <section
        class={["note-editor", className]}
        aria-label="Note"
        {...scopeAttributes(attributes)}
        style={style}
      >
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
  },
);

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const key of Object.keys(props)) {
    if (key.startsWith("data-uf-")) scope[key] = "";
  }
  return scope;
}
