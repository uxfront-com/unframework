import { cx } from "./_unframework/cx";
import { scopeAttributes } from "./_unframework/scopeAttributes";
import { type CSSProperties, type KeyboardEvent, useRef } from "react";

export interface SearchToggleAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function SearchToggle({ className, style, ...attributes }: SearchToggleAttributes) {
  const field = useRef<HTMLInputElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  function focusField() {
    field.current?.focus();
  }

  function returnFocus(event: KeyboardEvent) {
    if (event.key === "Escape") trigger.current?.focus();
  }

  return (
    <div
      className={cx("search-toggle", className)}
      role="search"
      style={style}
      {...scopeAttributes(attributes)}
    >
      <button type="button" ref={trigger} onClick={focusField}>
        Search
      </button>
      <input name="query" aria-label="Search the docs" ref={field} onKeyDown={returnFocus} />
    </div>
  );
}
