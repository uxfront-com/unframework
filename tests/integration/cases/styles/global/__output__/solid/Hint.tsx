import type { JSX } from "solid-js";

export default function Hint(
  props: { text: string } & { class?: string; style?: JSX.CSSProperties },
) {
  return (
    <p class={props.class ? `hint ${props.class}` : "hint"} style={props.style}>
      Tip: <span class="uf-highlight">{props.text}</span>
    </p>
  );
}
