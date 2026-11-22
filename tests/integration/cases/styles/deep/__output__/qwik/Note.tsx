import { type CSSProperties, type ClassList, type PropsOf, component$ } from "@qwik.dev/core";

export default component$<
  { text: string } & Omit<PropsOf<"div">, "text" | "class" | "style"> & {
      class?: ClassList;
      style?: CSSProperties;
    }
>(({ text, class: className, style, ...attributes }) => {
  return (
    <div class={["note-box", className]} style={style} {...attributes}>
      <p class="note">{text}</p>
    </div>
  );
});
