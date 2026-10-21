import type { JSX } from "solid-js";

export default function Action(
  props: { text: string } & { class?: string; style?: JSX.CSSProperties },
) {
  return (
    <button
      type="button"
      class={props.class ? `action ${props.class}` : "action"}
      data-uf-6173c12c=""
      style={props.style}
    >
      {props.text}
    </button>
  );
}
