import Note from "./Note";
import type { JSX } from "solid-js";
import "./Article.uf.tsx.css";

export default function Article(
  props: { title: string; note: string } & { class?: string; style?: JSX.CSSProperties },
) {
  return (
    <article
      class={props.class ? `article ${props.class}` : "article"}
      data-uf-15946226=""
      style={props.style}
      {...scopeAttributes(props)}
    >
      <h2 class="title" data-uf-15946226="">
        {props.title}
      </h2>
      <Note text={props.note} data-uf-15946226="" />
    </article>
  );
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
}
