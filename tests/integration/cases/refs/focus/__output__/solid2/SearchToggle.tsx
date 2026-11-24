import type { ComponentProps, JSX } from "@solidjs/web";
import { omit, onCleanup } from "solid-js";

export default function SearchToggle(
  props: Omit<ComponentProps<"div">, "class" | "style"> & {
    class?: string;
    style?: JSX.CSSProperties;
  },
) {
  const others = omit(props, "class");

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
      {...others}
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

/** A `ref` that calls `callback` with its element, and `clear` once the element is removed. */
function clearedRef<T>(callback: (element: T) => void, clear: () => void): (element: T) => void {
  onCleanup(clear);
  return callback;
}
