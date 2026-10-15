import { type JSX, onCleanup, untrack } from "solid-js";

export default function SearchField(
  props: { label: string } & {
    class?: string;
    style?: JSX.CSSProperties;
    ref?: (api: { focus: () => void }) => void;
  },
) {
  let input: HTMLInputElement | null = null;

  function focus() {
    input?.focus();
  }

  untrack(() => props.ref?.({ focus }));

  return (
    <label class={props.class ? `search ${props.class}` : "search"} style={props.style}>
      {props.label}
      <input
        ref={(element) => {
          input = element;
          onCleanup(() => {
            input = null;
          });
        }}
        type="search"
      />
    </label>
  );
}
