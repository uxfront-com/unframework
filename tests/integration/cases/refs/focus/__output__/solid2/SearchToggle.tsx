import type { JSX } from "@solidjs/web";
import { onCleanup } from "solid-js";

export default function SearchToggle(props: { class?: string; style?: JSX.CSSProperties }) {
  let field: HTMLInputElement | null = null;
  let trigger: HTMLButtonElement | null = null;

  function focusField() {
    field?.focus();
  }

  function returnFocus(event: KeyboardEvent) {
    if (event.key === "Escape") trigger?.focus();
  }

  return (
    <div
      class={props.class ? `search-toggle ${props.class}` : "search-toggle"}
      role="search"
      style={props.style}
      {...scopeAttributes(props)}
    >
      <button
        type="button"
        ref={clearedRef(
          (element) => {
            trigger = element;
          },
          () => {
            trigger = null;
          },
        )}
        onClick={focusField}
      >
        Search
      </button>
      <input
        name="query"
        aria-label="Search the docs"
        ref={clearedRef(
          (element) => {
            field = element;
          },
          () => {
            field = null;
          },
        )}
        onKeyDown={returnFocus}
      />
    </div>
  );
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
}

/** A `ref` that calls `callback` with its element, and `clear` once the element is removed. */
function clearedRef<T>(callback: (element: T) => void, clear: () => void): (element: T) => void {
  onCleanup(clear);
  return callback;
}
