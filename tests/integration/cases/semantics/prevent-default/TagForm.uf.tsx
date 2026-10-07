import { defineEmits, ref, useTemplateRef } from "unframework";

export default function TagForm() {
  const emit = defineEmits<{ tagsChange: [tags: string[]] }>();

  const tags = ref<string[]>([]);
  const draft = ref("");
  const helpOpen = ref(false);
  const field = useTemplateRef<HTMLInputElement>();

  function blockComma(event: KeyboardEvent) {
    if (event.key === ",") event.preventDefault();
  }

  function updateDraft(event: InputEvent) {
    draft.value = (event.currentTarget as HTMLInputElement).value;
  }

  function addTag(event: SubmitEvent) {
    event.preventDefault();
    if (draft.value !== "" && !tags.value.includes(draft.value)) {
      tags.value = [...tags.value, draft.value];
      emit("tagsChange", tags.value);
    }
    draft.value = "";
    const input = field.value;
    if (input) input.value = "";
  }

  function toggleHelp(event: MouseEvent) {
    event.preventDefault();
    helpOpen.value = !helpOpen.value;
  }

  return (
    <form class="tag-form" aria-label="Tags" onSubmit={addTag}>
      <label>
        New tag
        <input name="tag" ref={field} onKeydown={blockComma} onInput={updateDraft} />
      </label>
      <button type="submit">Add tag</button>
      <a href="/help/tags" onClick={toggleHelp}>
        How tags work
      </a>
      {helpOpen.value && <p>A tag is one word: commas are not allowed.</p>}
      <ul aria-label="Added tags">
        {tags.value.map((tag) => (
          <li key={tag}>{tag}</li>
        ))}
      </ul>
    </form>
  );
}
