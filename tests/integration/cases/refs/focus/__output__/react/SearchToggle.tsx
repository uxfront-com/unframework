import { type KeyboardEvent, useRef } from "react";

export default function SearchToggle() {
  const field = useRef<HTMLInputElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  function focusField() {
    field.current?.focus();
  }

  function returnFocus(event: KeyboardEvent) {
    if (event.key === "Escape") trigger.current?.focus();
  }

  return (
    <div className="search-toggle" role="search">
      <button type="button" ref={trigger} onClick={focusField}>
        Search
      </button>
      <input name="query" aria-label="Search the docs" ref={field} onKeyDown={returnFocus} />
    </div>
  );
}
