import { type CSSProperties, type ClassList, type PropsOf, component$ } from "@qwik.dev/core";

export default component$<
  { text: string } & Omit<PropsOf<"button">, "text" | "class" | "style"> & {
      class?: ClassList;
      style?: CSSProperties;
    }
>(({ text, class: className, style, ...attributes }) => {
  return (
    <button type="button" class={["button", className]} style={style} {...attributes}>
      <span class="icon" aria-hidden="true">
        +
      </span>
      {text}
    </button>
  );
});
