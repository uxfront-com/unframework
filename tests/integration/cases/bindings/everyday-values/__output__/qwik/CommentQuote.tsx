import { type CSSProperties, type ClassList, component$ } from "@qwik.dev/core";

export interface CommentQuoteProps {
  author: string;
  comment: string;
}

export default component$<CommentQuoteProps & { class?: ClassList; style?: CSSProperties }>(
  ({ author, comment, class: className, style, ...attributes }) => {
    return (
      <figure class={["comment-quote", className]} {...scopeAttributes(attributes)} style={style}>
        <blockquote style={{ margin: "0", padding: "0" }}>
          <p dir="auto">{comment}</p>
        </blockquote>
        <figcaption>{author}</figcaption>
      </figure>
    );
  },
);

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const key of Object.keys(props)) {
    if (key.startsWith("data-uf-")) scope[key] = "";
  }
  return scope;
}
