import { type ComponentProps, type JSX, splitProps } from "solid-js";
import { Dynamic } from "solid-js/web";

export default function Heading(
  props: { big: boolean; text: string } & Omit<
    Omit<
      ComponentProps<"h2"> & ComponentProps<"h3">,
      keyof JSX.DOMAttributes<HTMLElementTagNameMap["h2" | "h3"]>
    > &
      JSX.DOMAttributes<HTMLElementTagNameMap["h2" | "h3"]>,
    "big" | "text" | "style"
  > & { style?: JSX.CSSProperties },
) {
  const [, others] = splitProps(props, ["big", "text", "ref", "class"]);

  return (
    <Dynamic
      component={props.big ? "h2" : "h3"}
      class={props.class ? `heading ${props.class}` : "heading"}
      ref={(element: HTMLElementTagNameMap["h2" | "h3"]) => {
        if (typeof props.ref === "function") props.ref(element);
      }}
      {...others}
    >
      {props.text}
    </Dynamic>
  );
}
