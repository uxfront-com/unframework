import SearchField from "./SearchField";
import { type CSSProperties, type ClassList, component$, useSignal } from "@qwik.dev/core";

export default component$<{ class?: ClassList; style?: CSSProperties }>(
  ({ class: className, style, ...attributes }) => {
    const search = useSignal<{ focus(): void }>();

    return (
      <header class={["header", className]} {...scopeAttributes(attributes)} style={style}>
        <SearchField ref={search} label="Find" />
        <button type="button" onClick$={() => search.value?.focus()}>
          Search
        </button>
      </header>
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
