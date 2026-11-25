import { clearedRef } from "./_unframework/clearedRef";
import { createState } from "./_unframework/createState";
import type { ComponentProps, JSX } from "@solidjs/web";
import { omit } from "solid-js";

export interface NoteEditorEvents {
  onSaved?: (count: number) => void;
  onTagged?: (tag: string, via: string) => void;
}

export default function NoteEditor(
  props: NoteEditorEvents &
    Omit<ComponentProps<"section">, "class" | "style"> & {
      class?: string;
      style?: JSX.CSSProperties;
    },
) {
  const others = omit(props, "onSaved", "onTagged", "class");

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
      {...others}
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
