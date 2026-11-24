import { type CSSProperties, type ClassList, type PropsOf, component$ } from "@qwik.dev/core";
import "virtual:styleframe.css";

export default component$<
  { text: string } & Omit<PropsOf<"p">, "text" | "class" | "style"> & {
      class?: ClassList;
      style?: CSSProperties;
    }
>(({ text, class: className, style, ...attributes }) => {
  return (
    <p
      class={["_padding:md _background-color:surface _color:text", className]}
      style={style}
      {...attributes}
    >
      {text}
    </p>
  );
});
