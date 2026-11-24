import { type CSSProperties, type ClassList, type PropsOf, component$ } from "@qwik.dev/core";
import "virtual:styleframe.css";

export default component$<
  { text: string; dark?: boolean } & Omit<
    PropsOf<"section">,
    "text" | "dark" | "class" | "style"
  > & { class?: ClassList; style?: CSSProperties }
>(({ text, dark = false, class: className, style, ...attributes }) => {
  return (
    <section
      data-theme={dark ? "dark" : "light"}
      class={["_padding:md _background-color:surface _color:text", className]}
      style={style}
      {...attributes}
    >
      {text}
    </section>
  );
});
