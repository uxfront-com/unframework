import Note from "./Note";
import { type CSSProperties, type ClassList, component$, useStyles$ } from "@qwik.dev/core";
import styles from "./Article.uf.tsx.css?inline";

export default component$<
  { title: string; note: string } & { class?: ClassList; style?: CSSProperties }
>(({ title, note, class: className, style, ...attributes }) => {
  useStyles$(styles);

  return (
    <article
      class={["article", className]}
      data-uf-15946226=""
      {...scopeAttributes(attributes)}
      style={style}
    >
      <h2 class="title" data-uf-15946226="">
        {title}
      </h2>
      <Note text={note} data-uf-15946226="" />
    </article>
  );
});

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const key of Object.keys(props)) {
    if (key.startsWith("data-uf-")) scope[key] = "";
  }
  return scope;
}
