import { defineEmits, onMounted, onUnmounted, ref } from "unframework";

export default function DraftEditor() {
  const emit = defineEmits<{ saved: [count: number] }>();

  const saves = ref(0);

  function onShortcut(event: KeyboardEvent) {
    if (event.key !== "s" || !event.ctrlKey) return;
    event.preventDefault();
    saves.value += 1;
    emit("saved", saves.value);
  }

  onMounted(() => {
    document.addEventListener("keydown", onShortcut);
  });

  onUnmounted(() => {
    document.removeEventListener("keydown", onShortcut);
  });

  return (
    <section class="draft-editor" aria-label="Draft">
      <label>
        Draft
        <textarea name="draft" />
      </label>
      <p role="status">Saved: {saves.value}</p>
    </section>
  );
}
