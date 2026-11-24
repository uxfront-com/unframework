import { type CSSProperties, type ClassList, type PropsOf, component$ } from "@qwik.dev/core";

export default component$<
  { big: boolean; text: string } & Omit<
    PropsOf<"h2"> & PropsOf<"h3">,
    "big" | "text" | "class" | "style"
  > & { class?: ClassList; style?: CSSProperties }
>(({ big, text, class: className, style, ...attributes }) => {
  const Tag = big ? "h2" : "h3";

  return (
    <>
      <Tag class={["heading", className]} style={style} {...attributes}>
        {text}
      </Tag>
    </>
  );
});
