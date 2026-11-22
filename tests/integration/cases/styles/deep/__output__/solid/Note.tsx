import { type ComponentProps, type JSX, splitProps } from "solid-js";

export default function Note(
  props: { text: string } & Omit<ComponentProps<"div">, "text" | "style"> & {
      style?: JSX.CSSProperties;
    },
) {
  const [, others] = splitProps(props, ["text", "class"]);

  return (
    <div class={props.class ? `note-box ${props.class}` : "note-box"} {...others}>
      <p class="note">{props.text}</p>
    </div>
  );
}
