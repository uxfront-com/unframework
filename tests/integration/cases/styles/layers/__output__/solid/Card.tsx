import type { JSX } from "solid-js";

export default function Card(
  props: { title: string } & { class?: string; style?: JSX.CSSProperties },
) {
  return (
    <section
      class={props.class ? `card ${props.class}` : "card"}
      data-uf-bb60e985=""
      style={props.style}
    >
      <h2 class="title" data-uf-bb60e985="">
        {props.title}
      </h2>
    </section>
  );
}
