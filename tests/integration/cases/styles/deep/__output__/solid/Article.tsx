import Note from "./Note";
import type { JSX } from "solid-js";

export default function Article(
  props: { title: string; note: string } & { class?: string; style?: JSX.CSSProperties },
) {
  return (
    <article
      class={props.class ? `article ${props.class}` : "article"}
      data-uf-15946226=""
      style={props.style}
    >
      <h2 class="title" data-uf-15946226="">
        {props.title}
      </h2>
      <Note text={props.note} data-uf-15946226="" />
    </article>
  );
}
