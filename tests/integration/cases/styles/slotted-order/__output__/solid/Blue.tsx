import { type ComponentProps, type JSX, splitProps } from "solid-js";
import "./Blue.uf.tsx.css";

export interface BlueSlots {
  children?: JSX.Element;
}

export default function Blue(
  props: BlueSlots &
    Omit<ComponentProps<"div">, "children" | "style"> & { style?: JSX.CSSProperties },
) {
  const [, others] = splitProps(props, ["children", "class"]);

  return (
    <div class={props.class ? `blue ${props.class}` : "blue"} data-uf-721c504a="" {...others}>
      {props.children}
    </div>
  );
}
