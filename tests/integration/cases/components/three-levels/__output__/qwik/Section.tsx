import Heading from "./Heading";
import { type CSSProperties, type ClassList, type PropsOf, component$ } from "@qwik.dev/core";

export default component$<
  { title: string; body: string } & Omit<
    PropsOf<"section">,
    "title" | "body" | "class" | "style"
  > & { class?: ClassList; style?: CSSProperties }
>(({ title, body, class: className, style, ...attributes }) => {
  return (
    <section class={["section", className]} style={style} {...attributes}>
      <Heading text={title} />
      <p>{body}</p>
    </section>
  );
});
