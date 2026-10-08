// UF2019 erased-type-reference: `OnCleanup` is an authoring type, which the compiler erases with
// its import, so an output that copied the annotation would not type-check; the likely fix removes
// the annotation, which `watch` already types.
import { defineEmits, ref, watch } from "unframework";
import type { OnCleanup } from "unframework";

export default function PresenceBadge() {
  const emit = defineEmits<{ join: [user: string]; leave: [user: string] }>();

  const user = ref("ada");

  watch(user, (value, previous, onCleanup: OnCleanup) => {
    emit("join", value);
    onCleanup(() => {
      emit("leave", value);
    });
  });

  return (
    <div class="presence-badge">
      <p role="status">Signed in as {user.value}</p>
      <button type="button" onClick={() => (user.value = "grace")}>
        Switch to Grace
      </button>
    </div>
  );
}
