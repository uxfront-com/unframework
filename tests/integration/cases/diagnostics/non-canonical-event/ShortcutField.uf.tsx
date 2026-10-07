// UF3004 non-canonical-attribute: React's event names `onKeyDown` and `onDoubleClick` are written
// with Vue's, `onKeydown` and `onDblclick`; the safe fix renames each.
import { defineEmits, ref } from "unframework";

export default function ShortcutField() {
  const emit = defineEmits<{ confirm: [] }>();

  const editing = ref(false);

  function handleKey(event: KeyboardEvent) {
    if (event.key === "Enter") emit("confirm");
  }

  return (
    <div class="shortcut-field">
      <input name="shortcut" aria-label="Shortcut" onKeyDown={handleKey} />
      <button type="button" onDoubleClick={() => (editing.value = !editing.value)}>
        {editing.value ? "Done" : "Edit"}
      </button>
    </div>
  );
}
