// UF3036 unknown-event: `onX` on a component listens to an event it declares, or to a DOM event
// that falls through to its root (ADR-0118); `onSave` is misspelt `onSvae`, which is no DOM event
// either, and the likely fix renames it.
import { defineEmits, ref } from "@uxfront/unframework";

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
