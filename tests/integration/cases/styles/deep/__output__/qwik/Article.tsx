import Note from "./Note";
import { type CSSProperties, type ClassList, component$ } from "@qwik.dev/core";

export default component$<
  { title: string; note: string } & { class?: ClassList; style?: CSSProperties }
>(({ title, note, class: className, style }) => {
  return (
    <article class={["article", className]} data-uf-15946226="" style={style}>
      <h2 class="title" data-uf-15946226="">
        {title}
      </h2>
      <Note text={note} data-uf-15946226="" />
    </article>
  );
});
