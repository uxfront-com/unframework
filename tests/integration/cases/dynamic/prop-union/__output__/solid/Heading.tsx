import { type ComponentProps, type JSX, splitProps } from "solid-js";
import { Dynamic } from "solid-js/web";

export default function Heading(
  props: { tag: "h1" | "h2" | "h3"; text: string } & Omit<
    Omit<
      ComponentProps<"h1"> & ComponentProps<"h2"> & ComponentProps<"h3">,
      keyof JSX.DOMAttributes<HTMLElementTagNameMap["h1" | "h2" | "h3"]>
    > &
      JSX.DOMAttributes<HTMLElementTagNameMap["h1" | "h2" | "h3"]>,
    "tag" | "text" | "style"
  > & { style?: JSX.CSSProperties },
) {
  const [, others] = splitProps(props, ["tag", "text", "ref", "class"]);

  return (
    <Dynamic
      component={props.tag}
      class={props.class ? `heading ${props.class}` : "heading"}
      ref={(element: HTMLElementTagNameMap["h1" | "h2" | "h3"]) => {
        if (typeof props.ref === "function") props.ref(element);
      }}
      {...others}
    >
      {props.text}
    </Dynamic>
  );
}
