import Button from "./Button";
import type { JSX } from "solid-js";

export default function Toolbar(props: { class?: string; style?: JSX.CSSProperties }) {
  return (
    <div
      role="toolbar"
      aria-label="Actions"
      class={props.class ? `toolbar ${props.class}` : "toolbar"}
      data-uf-a33d603f=""
      style={props.style}
    >
      <Button text="Save" data-uf-a33d603f="" />
      <Button text="Cancel" data-uf-a33d603f="" />
    </div>
  );
}
