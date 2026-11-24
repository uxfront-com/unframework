import type { ComponentProps, JSX } from "@solidjs/web";
import { merge, omit } from "solid-js";
import "virtual:styleframe.css";

export default function Themed(
  rawProps: { text: string; dark?: boolean } & Omit<
    ComponentProps<"section">,
    "text" | "dark" | "class" | "style"
  > & { class?: string; style?: JSX.CSSProperties },
) {
  const props = merge(rawProps, {
    get dark() {
      return rawProps.dark === undefined ? false : rawProps.dark;
    },
  });
  const others = omit(props, "text", "dark", "class");

  return (
    <section
      data-theme={props.dark ? "dark" : "light"}
      class={
        props.class
          ? `_padding:md _background-color:surface _color:text ${props.class}`
          : "_padding:md _background-color:surface _color:text"
      }
      {...others}
    >
      {props.text}
    </section>
  );
}
