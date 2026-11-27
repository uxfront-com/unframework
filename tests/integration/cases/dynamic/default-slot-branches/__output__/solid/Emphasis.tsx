import { type ComponentProps, type JSX, Show, splitProps } from "solid-js";

export interface EmphasisSlots {
  children?: JSX.Element;
}

export default function Emphasis(
  props: { strong: boolean } & EmphasisSlots &
    Omit<ComponentProps<"p">, "strong" | "children" | "style"> & { style?: JSX.CSSProperties },
) {
  const [, others] = splitProps(props, ["strong", "children", "class"]);

  return (
    <p class={props.class ? `emphasis ${props.class}` : "emphasis"} {...others}>
      <Show when={props.strong} fallback={<i>{props.children}</i>}>
        <b>{props.children}</b>
      </Show>
    </p>
  );
}
