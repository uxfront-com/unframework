import SearchField from "./SearchField";
import { type CSSProperties, type ClassList, component$, useSignal } from "@qwik.dev/core";

export default component$<{ class?: ClassList; style?: CSSProperties }>(
  ({ class: className, style }) => {
    const search = useSignal<{ focus(): void }>();

    return (
      <header class={["header", className]} style={style}>
        <SearchField ref={search} label="Find" />
        <button type="button" onClick$={() => search.value?.focus()}>
          Search
        </button>
      </header>
    );
  },
);
