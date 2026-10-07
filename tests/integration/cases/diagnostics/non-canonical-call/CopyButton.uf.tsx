// UF2025 non-canonical-call: `nextTick` is given a callback, which React's, Angular's and Qwik's
// `nextTick` never run. `await nextTick()` is its one form: the safe fix makes `copy` async,
// awaits `nextTick()`, and runs the callback's code after it.
import { defineEmits, nextTick, ref, useTemplateRef } from "unframework";

export default function CopyButton() {
  const emit = defineEmits<{ copied: [text: string] }>();
  const done = ref(false);
  const label = useTemplateRef<HTMLSpanElement>();

  function copy() {
    done.value = true;
    nextTick(() => {
      emit("copied", label.value?.textContent ?? "");
    });
  }

  return (
    <button type="button" onClick={copy}>
      <span ref={label}>{done.value ? "Copied" : "Copy"}</span>
    </button>
  );
}
