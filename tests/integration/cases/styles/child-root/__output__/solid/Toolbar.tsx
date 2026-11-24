import Button from "./Button";
import { type ComponentProps, type JSX, splitProps } from "solid-js";
import "./Toolbar.uf.tsx.css";

export default function Toolbar(
  props: Omit<ComponentProps<"div">, "style"> & { style?: JSX.CSSProperties },
) {
  const [, others] = splitProps(props, ["class"]);

  return (
    <div
      role="toolbar"
      aria-label="Actions"
      class={props.class ? `toolbar ${props.class}` : "toolbar"}
      data-uf-a33d603f=""
      {...others}
    >
      <Button text="Save" data-uf-a33d603f="" />
      <Button text="Cancel" data-uf-a33d603f="" />
    </div>
  );
}
