import type { ComponentProps, JSX } from "@solidjs/web";
import { omit } from "solid-js";
import "./Mat.uf.tsx.css";

export interface MatSlots {
  children?: JSX.Element;
}

export default function Mat(
  props: MatSlots &
    Omit<ComponentProps<"div">, "children" | "class" | "style"> & {
      class?: string;
      style?: JSX.CSSProperties;
    },
) {
  const others = omit(props, "children", "class");

  return (
    <div class={props.class ? `mat ${props.class}` : "mat"} data-uf-09929c4a="" {...others}>
      {props.children}
    </div>
  );
}
