import Button from "./Button";
import type { ComponentProps, JSX } from "@solidjs/web";
import { omit } from "solid-js";
import "./Toolbar.uf.tsx.css";

export default function Toolbar(
  props: Omit<ComponentProps<"div">, "class" | "style"> & {
    class?: string;
    style?: JSX.CSSProperties;
  },
) {
  const others = omit(props, "class");

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
