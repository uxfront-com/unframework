import type { JSX } from "solid-js";

export interface CommentQuoteProps {
  author: string;
  comment: string;
}

export default function CommentQuote(
  props: CommentQuoteProps & { class?: string; style?: JSX.CSSProperties },
) {
  return (
    <figure
      class={props.class ? `comment-quote ${props.class}` : "comment-quote"}
      style={props.style}
      {...scopeAttributes(props)}
    >
      <blockquote style={{ margin: "0", padding: "0" }}>
        <p dir="auto">{props.comment}</p>
      </blockquote>
      <figcaption>{props.author}</figcaption>
    </figure>
  );
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
}
