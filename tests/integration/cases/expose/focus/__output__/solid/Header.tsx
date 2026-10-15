import SearchField from "./SearchField";
import { type JSX, onCleanup } from "solid-js";

export default function Header(props: { class?: string; style?: JSX.CSSProperties }) {
  let search: { focus(): void } | null = null;

  return (
    <header class={props.class ? `header ${props.class}` : "header"} style={props.style}>
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
