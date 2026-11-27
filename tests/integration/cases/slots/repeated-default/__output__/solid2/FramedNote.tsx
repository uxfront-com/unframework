import type { ComponentProps, JSX } from "@solidjs/web";
import { omit } from "solid-js";

export interface FramedNoteSlots {
  children?: JSX.Element;
}

export default function FramedNote(
  props: { title: string } & FramedNoteSlots &
    Omit<ComponentProps<"article">, "title" | "children" | "class" | "style"> & {
      class?: string;
      style?: JSX.CSSProperties;
    },
) {
  const others = omit(props, "title", "children", "class");

  return (
    <article class={props.class ? `framed-note ${props.class}` : "framed-note"} {...others}>
      <header>{props.children}</header>
      <p>{props.title}</p>
      <footer>{props.children}</footer>
    </article>
  );
}
