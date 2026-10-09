import { ref } from "unframework";

export default function NoteEditor() {
  const note = ref("Buy milk");
  return (
    <section aria-label="Note">
      <textarea aria-label="Text" v-model={note.value} />
      <output>{note.value.length} characters</output>
      <button type="button" onClick={() => (note.value = "")}>
        Discard
      </button>
    </section>
  );
}
