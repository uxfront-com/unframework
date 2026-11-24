import { type ComponentPropsWithRef, type KeyboardEvent, useRef } from "react";

export type SearchToggleAttributes = Omit<ComponentPropsWithRef<"div">, "children">;

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
    <div className={cx("search-toggle", className)} role="search" style={style} {...attributes}>
      <button type="button" ref={trigger} onClick={focusField}>
        Search
      </button>
      <input name="query" aria-label="Search the docs" ref={field} onKeyDown={returnFocus} />
    </div>
  );
}

/** Joins class names, and the keys of an object's truthy entries, into one `className`. */
function cx(...parts: unknown[]): string {
  const names: string[] = [];
  for (const part of parts) {
    if (typeof part === "string") {
      if (part) names.push(part);
    } else if (part && typeof part === "object") {
      for (const [key, on] of Object.entries(part)) {
        if (on) names.push(key);
      }
    }
  }
  return names.join(" ");
}
