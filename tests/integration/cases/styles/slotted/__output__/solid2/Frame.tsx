import type { ComponentProps, JSX } from "@solidjs/web";
import { omit } from "solid-js";
import "./Frame.uf.tsx.css";

export interface FrameSlots {
  children?: JSX.Element;
  label?: (props: { text: string }) => JSX.Element;
}

export default function Frame(
  props: FrameSlots &
    Omit<ComponentProps<"figure">, "children" | "label" | "class" | "style"> & {
      class?: string;
      style?: JSX.CSSProperties;
    },
) {
  const others = omit(props, "children", "label", "class");

  return (
    <figure class={props.class ? `frame ${props.class}` : "frame"} data-uf-9dc516fd="" {...others}>
      {props.children}
      {props.label?.({ text: "Harbour at dusk" })}
    </figure>
  );
}
