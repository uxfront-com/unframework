import { type ComponentProps, type JSX, mergeProps, splitProps } from "solid-js";
import "virtual:styleframe.css";

export default function Themed(
  rawProps: { text: string; dark?: boolean } & Omit<
    ComponentProps<"section">,
    "text" | "dark" | "style"
  > & { style?: JSX.CSSProperties },
) {
  const props = mergeProps(
    { dark: false } satisfies Partial<{ text: string; dark?: boolean }>,
    rawProps,
  );
  const [, others] = splitProps(props, ["text", "dark", "class"]);

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
