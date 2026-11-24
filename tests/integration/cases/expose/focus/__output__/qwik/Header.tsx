import SearchField from "./SearchField";
import {
  type CSSProperties,
  type ClassList,
  type PropsOf,
  component$,
  useSignal,
} from "@qwik.dev/core";

export default component$<
  Omit<PropsOf<"header">, "class" | "style"> & { class?: ClassList; style?: CSSProperties }
>(({ class: className, style, ...attributes }) => {
  const search = useSignal<{ focus(): void }>();

  return (
    <header class={["header", className]} style={style} {...attributes}>
      <SearchField ref={search} label="Find" />
      <button type="button" onClick$={() => search.value?.focus()}>
        Search
      </button>
    </header>
  );
});
