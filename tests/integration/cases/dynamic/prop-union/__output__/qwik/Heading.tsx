import { type CSSProperties, type ClassList, type PropsOf, component$ } from "@qwik.dev/core";

export default component$<
  { tag: "h1" | "h2" | "h3"; text: string } & Omit<
    PropsOf<"h1"> & PropsOf<"h2"> & PropsOf<"h3">,
    "tag" | "text" | "class" | "style"
  > & { class?: ClassList; style?: CSSProperties }
>(({ tag, text, class: className, style, ...attributes }) => {
  const Tag = tag;

  return (
    <>
      <Tag class={["heading", className]} style={style} {...attributes}>
        {text}
      </Tag>
    </>
  );
});
