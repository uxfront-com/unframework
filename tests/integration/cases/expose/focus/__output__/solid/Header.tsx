import SearchField from "./SearchField";
import { type JSX, onCleanup } from "solid-js";

export default function Header(props: { class?: string; style?: JSX.CSSProperties }) {
  let search: { focus(): void } | null = null;

  return (
    <header
      class={props.class ? `header ${props.class}` : "header"}
      style={props.style}
      {...scopeAttributes(props)}
    >
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

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
}
