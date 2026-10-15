import type { JSX } from "solid-js";

export function SelectRow(
  props: { value: string } & { class?: string; style?: JSX.CSSProperties },
) {
  return (
    <option value={props.value} class={props.class} style={props.style}>
      {props.value}
    </option>
  );
}
