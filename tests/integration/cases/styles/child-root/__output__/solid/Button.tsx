import type { JSX } from "solid-js";

export default function Button(
  props: { text: string } & { class?: string; style?: JSX.CSSProperties },
) {
  return (
    <button
      type="button"
      class={props.class ? `button ${props.class}` : "button"}
      style={props.style}
    >
      <span class="icon" aria-hidden="true">
        +
      </span>
      {props.text}
    </button>
  );
}
