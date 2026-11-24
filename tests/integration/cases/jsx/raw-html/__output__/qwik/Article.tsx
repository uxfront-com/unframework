import { type CSSProperties, type ClassList, type PropsOf, component$ } from "@qwik.dev/core";

export interface ArticleProps {
  title: string;
  body: string;
}

export default component$<
  ArticleProps &
    Omit<PropsOf<"article">, "title" | "body" | "class" | "style"> & {
      class?: ClassList;
      style?: CSSProperties;
    }
>(({ title, body, class: className, style, ...attributes }) => {
  return (
    <article class={["article", className]} style={style} {...attributes}>
      <h2>{title}</h2>
      <div class="body" dangerouslySetInnerHTML={body || undefined} />
      <footer dangerouslySetInnerHTML={"<small>Filed under <em>News</em></small>"} />
    </article>
  );
});
