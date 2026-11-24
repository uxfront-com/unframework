import type { ComponentProps, JSX } from "@solidjs/web";
import { Show, children, omit } from "solid-js";

export interface CardSlots {
  title?: JSX.Element;
  children?: JSX.Element;
}

export default function Card(
  props: { label: string } & CardSlots &
    Omit<ComponentProps<"section">, "label" | "title" | "children" | "class" | "style"> & {
      class?: string;
      style?: JSX.CSSProperties;
    },
) {
  const others = omit(props, "label", "title", "children", "class");

  const title = children(() => props.title);
  const content = children(() => props.children);
  return (
    <section
      class={props.class ? `card ${props.class}` : "card"}
      aria-label={props.label}
      {...others}
    >
      <Show when={title()}>
        <header class="title">{title()}</header>
      </Show>
      <Show when={content()} fallback={<p>Empty card</p>}>
        <div class="body">{content()}</div>
      </Show>
    </section>
  );
}
