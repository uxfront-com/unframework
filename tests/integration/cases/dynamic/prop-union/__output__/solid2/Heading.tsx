import { type ComponentProps, Dynamic, type JSX } from "@solidjs/web";
import { omit } from "solid-js";

export default function Heading(
  props: { tag: "h1" | "h2" | "h3"; text: string } & Omit<
    Omit<
      ComponentProps<"h1"> & ComponentProps<"h2"> & ComponentProps<"h3">,
      keyof JSX.ElementAttributes<HTMLElementTagNameMap["h1" | "h2" | "h3"]>
    > &
      JSX.ElementAttributes<HTMLElementTagNameMap["h1" | "h2" | "h3"]>,
    "tag" | "text" | "class" | "style"
  > & { class?: string; style?: JSX.CSSProperties },
) {
  const others = omit(props, "tag", "text", "ref", "class");

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
