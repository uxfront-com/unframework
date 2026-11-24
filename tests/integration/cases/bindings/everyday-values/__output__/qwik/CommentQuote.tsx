import { type CSSProperties, type ClassList, type PropsOf, component$ } from "@qwik.dev/core";

export interface CommentQuoteProps {
  author: string;
  comment: string;
}

export default component$<
  CommentQuoteProps &
    Omit<PropsOf<"figure">, "author" | "comment" | "class" | "style"> & {
      class?: ClassList;
      style?: CSSProperties;
    }
>(({ author, comment, class: className, style, ...attributes }) => {
  return (
    <figure class={["comment-quote", className]} style={style} {...attributes}>
      <blockquote style={{ margin: "0", padding: "0" }}>
        <p dir="auto">{comment}</p>
      </blockquote>
      <figcaption>{author}</figcaption>
    </figure>
  );
});
