// UF2017 invalid-emit: `emit("closed")` names an event the component does not declare: it
// declares `close`.
import { defineEmits } from "unframework";

export default function SettingsDialog() {
  const emit = defineEmits<{ close: [] }>();

  function dismiss() {
    emit("closed");
  }

  return (
    <div class="settings-dialog" role="dialog" aria-label="Settings">
      <button type="button" onClick={dismiss}>
        Close
      </button>
    </div>
  );
}
