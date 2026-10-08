import { useTemplateRef } from "unframework";

export default function SearchToggle() {
  const field = useTemplateRef<HTMLInputElement>();
  const trigger = useTemplateRef<HTMLButtonElement>();

  function focusField() {
    field.value?.focus();
  }

  function returnFocus(event: KeyboardEvent) {
    if (event.key === "Escape") trigger.value?.focus();
  }

  return (
    <div class="search-toggle" role="search">
      <button type="button" ref={trigger} onClick={focusField}>
        Search
      </button>
      <input name="query" aria-label="Search the docs" ref={field} onKeydown={returnFocus} />
    </div>
  );
}
