import { type ComponentProps, type JSX, onCleanup, splitProps, untrack } from "solid-js";

export default function SearchField(
  props: { label: string } & Omit<ComponentProps<"label">, "label" | "ref" | "style"> & {
      style?: JSX.CSSProperties;
      ref?: (api: { focus: () => void }) => void;
    },
) {
  const [, others] = splitProps(props, ["label", "ref", "class"]);

  let input: HTMLInputElement | null = null;

  function focus() {
    input?.focus();
  }

  untrack(() => props.ref?.({ focus }));

  return (
    <label class={props.class ? `search ${props.class}` : "search"} {...others}>
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
