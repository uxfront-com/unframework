// UF2022 function-value: `onMounted(focusField)` passes a local function by name, which Qwik and
// Angular cannot hand to their hooks as written; the safe fix wraps it, `() => focusField()`.
import { onMounted, useTemplateRef } from "unframework";

export default function SearchField() {
  const field = useTemplateRef<HTMLInputElement>();

  function focusField() {
    field.value?.focus();
  }

  onMounted(focusField);

  return <input class="search-field" name="query" aria-label="Search" ref={field} />;
}
