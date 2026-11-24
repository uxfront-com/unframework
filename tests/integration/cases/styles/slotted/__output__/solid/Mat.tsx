import { type ComponentProps, type JSX, splitProps } from "solid-js";
import "./Mat.uf.tsx.css";

export interface MatSlots {
  children?: JSX.Element;
}

export default function Mat(
  props: MatSlots &
    Omit<ComponentProps<"div">, "children" | "style"> & { style?: JSX.CSSProperties },
) {
  const [, others] = splitProps(props, ["children", "class"]);

  return (
    <div class={props.class ? `mat ${props.class}` : "mat"} data-uf-09929c4a="" {...others}>
      {props.children}
    </div>
  );
}
