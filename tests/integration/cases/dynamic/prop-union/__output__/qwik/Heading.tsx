import { scopeAttributes } from "./_unframework/scopeAttributes";
import { type CSSProperties, type ClassList, component$ } from "@qwik.dev/core";

export default component$<
  { tag: "h1" | "h2" | "h3"; text: string } & { class?: ClassList; style?: CSSProperties }
>(({ tag, text, class: className, style, ...attributes }) => {
  const Tag = tag;

  return (
    <>
      <Tag class={["heading", className]} {...scopeAttributes(attributes)} style={style}>
        {text}
      </Tag>
    </>
  );
});
