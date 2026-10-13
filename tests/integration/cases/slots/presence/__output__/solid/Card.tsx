import { type JSX, Show, children } from "solid-js";

export interface CardSlots {
  title?: JSX.Element;
  children?: JSX.Element;
}

export default function Card(
  props: { label: string } & CardSlots & { class?: string; style?: JSX.CSSProperties },
) {
  const content = children(() => props.children);
  return (
    <section
      class={props.class ? `card ${props.class}` : "card"}
      aria-label={props.label}
      style={props.style}
    >
      <Show when={props.title}>
        <header class="title">{props.title}</header>
      </Show>
      <Show when={content()} fallback={<p>Empty card</p>}>
        <div class="body">{content()}</div>
      </Show>
    </section>
  );
}
