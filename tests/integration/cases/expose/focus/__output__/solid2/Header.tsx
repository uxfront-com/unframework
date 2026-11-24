import SearchField from "./SearchField";
import type { ComponentProps, JSX } from "@solidjs/web";
import { omit, onCleanup } from "solid-js";

export default function Header(
  props: Omit<ComponentProps<"header">, "class" | "style"> & {
    class?: string;
    style?: JSX.CSSProperties;
  },
) {
  const others = omit(props, "class");

  let search: { focus(): void } | null = null;

  return (
    <header class={props.class ? `header ${props.class}` : "header"} {...others}>
      <SearchField
        ref={(api) => {
          search = api;
          onCleanup(() => {
            search = null;
          });
        }}
        label="Find"
      />
      <button type="button" onClick={() => search?.focus()}>
        Search
      </button>
    </header>
  );
}
