import type { JSX } from "solid-js";

export function Field(props: { label: string } & { class?: string; style?: JSX.CSSProperties }) {
  return (
    <label class={props.class} style={props.style}>
      {props.label} <input type="text" />
    </label>
  );
}
