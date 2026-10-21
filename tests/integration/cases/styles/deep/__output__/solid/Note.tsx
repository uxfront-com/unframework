import type { JSX } from "solid-js";

export default function Note(
  props: { text: string } & { class?: string; style?: JSX.CSSProperties },
) {
  return (
    <div class={props.class ? `note-box ${props.class}` : "note-box"} style={props.style}>
      <p class="note">{props.text}</p>
    </div>
  );
}
