import { $, type QRL, component$, sync$, useSignal } from "@qwik.dev/core";

export interface TagFormEvents {
  onTagsChange$?: QRL<(tags: string[]) => void>;
}

export default component$<TagFormEvents>(({ onTagsChange$ }) => {
  const tags = useSignal<string[]>([]);
  const draft = useSignal("");
  const helpOpen = useSignal(false);
  const field = useSignal<HTMLInputElement>();

  const updateDraft = $((event: InputEvent, element: Element) => {
    draft.value = (element as HTMLInputElement).value;
  });

  const addTag = $(() => {
    if (draft.value !== "" && !tags.value.includes(draft.value)) {
      tags.value = [...tags.value, draft.value];
      onTagsChange$?.(tags.value);
    }
    draft.value = "";
    const input = field.value;
    if (input) input.value = "";
  });

  const toggleHelp = $(() => {
    helpOpen.value = !helpOpen.value;
  });

  return (
    <form class="tag-form" aria-label="Tags" preventdefault:submit onSubmit$={addTag}>
      <label>
        New tag
        <input
          name="tag"
          ref={field}
          onKeyDown$={sync$((event: KeyboardEvent) => {
            if (event.key === ",") event.preventDefault();
          })}
          onInput$={updateDraft}
        />
      </label>
      <button type="submit">Add tag</button>
      <a href="/help/tags" preventdefault:click onClick$={toggleHelp}>
        How tags work
      </a>
      {helpOpen.value ? <p>A tag is one word: commas are not allowed.</p> : null}
      <ul aria-label="Added tags">
        {tags.value.map((tag) => (
          <li key={tag}>{tag}</li>
        ))}
      </ul>
    </form>
  );
});
