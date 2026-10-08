// UF2008 invalid-event-name: `level-change` is not camelCase, so the targets could not spell it as
// a prop (`onLevelChange`, Svelte's `onlevelchange`) or an Angular output; the safe fix renames it
// and its `emit` calls to `levelChange`.
import { defineEmits, ref } from "unframework";

export default function VolumeSlider() {
  const emit = defineEmits<{ "level-change": [level: number] }>();

  const level = ref(50);

  function louder() {
    level.value += 10;
    emit("level-change", level.value);
  }

  return (
    <div class="volume-slider" role="group" aria-label="Volume">
      <output>{level.value}</output>
      <button type="button" onClick={louder}>
        Louder
      </button>
    </div>
  );
}
