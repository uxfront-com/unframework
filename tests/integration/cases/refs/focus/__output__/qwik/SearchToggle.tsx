import { $, type CSSProperties, type ClassList, component$, useSignal } from "@qwik.dev/core";

export default component$<{ class?: ClassList; style?: CSSProperties }>(
  ({ class: className, style, ...attributes }) => {
    const field = useSignal<HTMLInputElement>();
    const trigger = useSignal<HTMLButtonElement>();

    const focusField = $(() => {
      field.value?.focus();
    });

    const returnFocus = $((event: KeyboardEvent) => {
      if (event.key === "Escape") trigger.value?.focus();
    });

    return (
      <div
        class={["search-toggle", className]}
        role="search"
        {...scopeAttributes(attributes)}
        style={style}
      >
        <button type="button" ref={trigger} onClick$={focusField}>
          Search
        </button>
        <input name="query" aria-label="Search the docs" ref={field} onKeyDown$={returnFocus} />
      </div>
    );
  },
);

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const key of Object.keys(props)) {
    if (key.startsWith("data-uf-")) scope[key] = "";
  }
  return scope;
}
