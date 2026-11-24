import Base from "./Base";
import { type CSSProperties, type ClassList, type PropsOf, component$ } from "@qwik.dev/core";

export default component$<
  { href?: string; text: string } & Omit<
    PropsOf<typeof Base>,
    "href" | "text" | "class" | "style"
  > & { class?: ClassList; style?: CSSProperties }
>(({ href, text, class: className, style, ...attributes }) => {
  return (
    <>
      <Base href={href} text={text} class={["primary", className]} style={style} {...attributes} />
    </>
  );
});
