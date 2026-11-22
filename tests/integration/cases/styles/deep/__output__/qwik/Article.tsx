import Note from "./Note";
import {
  type CSSProperties,
  type ClassList,
  type PropsOf,
  component$,
  useStyles$,
} from "@qwik.dev/core";
import styles from "./Article.uf.tsx.css?inline";

export default component$<
  { title: string; note: string } & Omit<
    PropsOf<"article">,
    "title" | "note" | "class" | "style"
  > & { class?: ClassList; style?: CSSProperties }
>(({ title, note, class: className, style, ...attributes }) => {
  useStyles$(styles);

  return (
    <article class={["article", className]} data-uf-15946226="" style={style} {...attributes}>
      <h2 class="title" data-uf-15946226="">
        {title}
      </h2>
      <Note text={note} data-uf-15946226="" />
    </article>
  );
});
