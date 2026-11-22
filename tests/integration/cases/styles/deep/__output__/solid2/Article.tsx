import Note from "./Note";
import type { ComponentProps, JSX } from "@solidjs/web";
import { omit } from "solid-js";
import "./Article.uf.tsx.css";

export default function Article(
  props: { title: string; note: string } & Omit<
    ComponentProps<"article">,
    "title" | "note" | "class" | "style"
  > & { class?: string; style?: JSX.CSSProperties },
) {
  const others = omit(props, "title", "note", "class");

  return (
    <article
      class={props.class ? `article ${props.class}` : "article"}
      data-uf-15946226=""
      {...others}
    >
      <h2 class="title" data-uf-15946226="">
        {props.title}
      </h2>
      <Note text={props.note} data-uf-15946226="" />
    </article>
  );
}
