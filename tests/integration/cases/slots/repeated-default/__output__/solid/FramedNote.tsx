import { type ComponentProps, type JSX, splitProps } from "solid-js";

export interface FramedNoteSlots {
  children?: JSX.Element;
}

export default function FramedNote(
  props: { title: string } & FramedNoteSlots &
    Omit<ComponentProps<"article">, "title" | "children" | "style"> & { style?: JSX.CSSProperties },
) {
  const [, others] = splitProps(props, ["title", "children", "class"]);

  return (
    <article class={props.class ? `framed-note ${props.class}` : "framed-note"} {...others}>
      <header>{props.children}</header>
      <p>{props.title}</p>
      <footer>{props.children}</footer>
    </article>
  );
}
