import type { ComponentProps, JSX } from "@solidjs/web";
import { omit } from "solid-js";
import "./Amber.uf.tsx.css";

export interface AmberSlots {
  children?: JSX.Element;
}

export default function Amber(
  props: AmberSlots &
    Omit<ComponentProps<"div">, "children" | "class" | "style"> & {
      class?: string;
      style?: JSX.CSSProperties;
    },
) {
  const others = omit(props, "children", "class");

  return (
    <div class={props.class ? `amber ${props.class}` : "amber"} data-uf-c97301b3="" {...others}>
      {props.children}
    </div>
  );
}
