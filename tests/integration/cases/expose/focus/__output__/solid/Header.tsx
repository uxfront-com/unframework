import SearchField from "./SearchField";
import { type ComponentProps, type JSX, onCleanup, splitProps } from "solid-js";

export default function Header(
  props: Omit<ComponentProps<"header">, "style"> & { style?: JSX.CSSProperties },
) {
  const [, others] = splitProps(props, ["class"]);

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
