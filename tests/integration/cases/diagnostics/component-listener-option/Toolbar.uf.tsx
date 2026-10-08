// UF3043 component-listener-option: a component's event is no DOM event, and takes no listener
// option: `onSaveOnce` listens to `save` with `Once`.
import { defineEmits, ref } from "unframework";

function SaveButton() {
  const emit = defineEmits<{ save: [] }>();
  return (
    <button type="button" onClick={() => emit("save")}>
      Save
    </button>
  );
}

export default function Toolbar() {
  const saves = ref(0);
  return (
    <div role="toolbar" aria-label="Edit">
      <SaveButton onSaveOnce={() => saves.value++} />
      <output>{saves.value}</output>
    </div>
  );
}
