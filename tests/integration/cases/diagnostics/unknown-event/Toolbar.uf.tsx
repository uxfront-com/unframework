// UF3036 unknown-event: `onX` on a component listens to an event it declares; `onSave` is
// misspelt `onSvae`, and the likely fix renames it.
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
      <SaveButton onSvae={() => saves.value++} />
      <output>{saves.value}</output>
    </div>
  );
}
