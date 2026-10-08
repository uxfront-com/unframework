import { For, Show, createSignal, onCleanup } from "solid-js";

export interface TagFormEvents {
  onTagsChange?: (tags: string[]) => void;
}

function blockComma(event: KeyboardEvent) {
  if (event.key === ",") event.preventDefault();
}

export default function TagForm(props: TagFormEvents) {
  const [tags, setTags] = createSignal<string[]>([]);
  const [draft, setDraft] = createSignal("");
  const [helpOpen, setHelpOpen] = createSignal(false);
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
    <form class="tag-form" aria-label="Tags" onSubmit={addTag}>
      <label>
        New tag
        <input
          name="tag"
          ref={(element) => {
            field = element;
            onCleanup(() => {
              field = null;
            });
          }}
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
        <For each={tags()}>{(tag) => <li>{tag}</li>}</For>
      </ul>
    </form>
  );
}
