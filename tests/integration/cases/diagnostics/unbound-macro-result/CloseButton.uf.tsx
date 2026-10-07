// UF2006 unbound-macro-result: `defineEmits` declares the events but its result, the `emit`
// function, is never bound; the likely fix writes `const emit = `.
import { defineEmits } from "unframework";

export default function CloseButton() {
  defineEmits<{ close: [] }>();

  return (
    <button type="button" class="close-button">
      Close
    </button>
  );
}
