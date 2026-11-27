import type { ComponentProps, JSX } from "@solidjs/web";
import { Show, omit } from "solid-js";

export interface EmphasisSlots {
  children?: JSX.Element;
}

export default function Emphasis(
  props: { strong: boolean } & EmphasisSlots &
    Omit<ComponentProps<"p">, "strong" | "children" | "class" | "style"> & {
      class?: string;
      style?: JSX.CSSProperties;
    },
) {
  const others = omit(props, "strong", "children", "class");

  return (
    <p class={props.class ? `emphasis ${props.class}` : "emphasis"} {...others}>
      <Show when={props.strong} fallback={<i>{props.children}</i>}>
        <b>{props.children}</b>
      </Show>
    </p>
  );
}
