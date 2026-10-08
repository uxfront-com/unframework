import { defineEmits, ref } from "unframework";

export default function NoteEditor() {
  const emit = defineEmits<{ saved: [title: string, bold: boolean] }>();

  const title = ref("");
  const bold = ref(false);
  const saves = ref(0);

  function save() {
    saves.value += 1;
    emit("saved", title.value, bold.value);
  }

  return (
    <form class="note-editor" aria-label="Note" onSubmit={(event) => event.preventDefault()}>
      <label>
        Title
        <input
          name="title"
          onInput={(event) => (title.value = (event.currentTarget as HTMLInputElement).value)}
        />
      </label>
      <label>
        Text
        <textarea name="text" />
      </label>
      <div class="format" role="group" aria-label="Format">
        <button
          type="button"
          aria-pressed={bold.value}
          onMousedown={(event) => event.preventDefault()}
          onClick={() => (bold.value = !bold.value)}
        >
          Bold
        </button>
      </div>
      <button type="submit" onClick={save}>
        Save
      </button>
      <p role="status">Saves: {saves.value}</p>
    </form>
  );
}
