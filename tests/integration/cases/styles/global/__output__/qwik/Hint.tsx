import { type CSSProperties, type ClassList, type PropsOf, component$ } from "@qwik.dev/core";

export default component$<
  { text: string } & Omit<PropsOf<"p">, "text" | "class" | "style"> & {
      class?: ClassList;
      style?: CSSProperties;
    }
>(({ text, class: className, style, ...attributes }) => {
  return (
    <p class={["hint", className]} style={style} {...attributes}>
      Tip: <span class="uf-highlight">{text}</span>
    </p>
  );
});
