import Heading from "./Heading";
import { type CSSProperties, type ClassList, component$ } from "@qwik.dev/core";

export default component$<
  { title: string; body: string } & { class?: ClassList; style?: CSSProperties }
>(({ title, body, class: className, style }) => {
  return (
    <section class={["section", className]} style={style}>
      <Heading text={title} />
      <p>{body}</p>
    </section>
  );
});
