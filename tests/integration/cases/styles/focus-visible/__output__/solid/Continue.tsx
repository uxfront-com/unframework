import type { JSX } from "solid-js";

export default function Continue(
  props: { text: string } & { class?: string; style?: JSX.CSSProperties },
) {
  return (
    <button
      type="button"
      class={props.class ? `continue ${props.class}` : "continue"}
      data-uf-bb3adc28=""
      style={props.style}
    >
      {props.text}
    </button>
  );
}
