import { type ComponentProps, Dynamic, type JSX } from "@solidjs/web";
import { omit } from "solid-js";

export default function Heading(
  props: { big: boolean; text: string } & Omit<
    Omit<
      ComponentProps<"h2"> & ComponentProps<"h3">,
      keyof JSX.ElementAttributes<HTMLElementTagNameMap["h2" | "h3"]>
    > &
      JSX.ElementAttributes<HTMLElementTagNameMap["h2" | "h3"]>,
    "big" | "text" | "class" | "style"
  > & { class?: string; style?: JSX.CSSProperties },
) {
  const others = omit(props, "big", "text", "ref", "class");

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
