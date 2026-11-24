import { type ComponentProps, type JSX, splitProps } from "solid-js";
import "./Frame.uf.tsx.css";

export interface FrameSlots {
  children?: JSX.Element;
  label?: (props: { text: string }) => JSX.Element;
}

export default function Frame(
  props: FrameSlots &
    Omit<ComponentProps<"figure">, "children" | "label" | "style"> & { style?: JSX.CSSProperties },
) {
  const [, others] = splitProps(props, ["children", "label", "class"]);

  return (
    <figure class={props.class ? `frame ${props.class}` : "frame"} data-uf-9dc516fd="" {...others}>
      {props.children}
      {props.label?.({ text: "Harbour at dusk" })}
    </figure>
  );
}
