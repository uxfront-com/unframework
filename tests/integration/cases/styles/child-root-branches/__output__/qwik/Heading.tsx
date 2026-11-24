import { scopeAttributes } from "./_unframework/scopeAttributes";
import { type CSSProperties, type ClassList, component$ } from "@qwik.dev/core";

export default component$<
  { big: boolean; text: string } & { class?: ClassList; style?: CSSProperties }
>(({ big, text, class: className, style, ...attributes }) => {
  const Tag = big ? "h2" : "h3";

  return (
    <>
      <Tag class={["heading", className]} {...scopeAttributes(attributes)} style={style}>
        {text}
      </Tag>
    </>
  );
});
