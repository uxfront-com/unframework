import type { JSX } from "solid-js";

export default function Panel(
  props: { text: string } & { class?: string; style?: JSX.CSSProperties },
) {
  return (
    <aside
      class={props.class ? `panel ${props.class}` : "panel"}
      data-uf-48dda3f4=""
      style={props.style}
    >
      <p class="text" data-uf-48dda3f4="">
        {props.text}
      </p>
    </aside>
  );
}
