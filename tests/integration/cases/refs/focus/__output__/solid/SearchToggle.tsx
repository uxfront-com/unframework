import { type JSX, onCleanup } from "solid-js";

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
    >
      <button
        type="button"
        ref={(element) => {
          trigger = element;
          onCleanup(() => {
            trigger = null;
          });
        }}
        onClick={focusField}
      >
        Search
      </button>
      <input
        name="query"
        aria-label="Search the docs"
        ref={(element) => {
          field = element;
          onCleanup(() => {
            field = null;
          });
        }}
        onKeyDown={returnFocus}
      />
    </div>
  );
}
