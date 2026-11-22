import { type ComponentProps, type JSX, splitProps } from "solid-js";
import "./Panel.uf.tsx.css";

export default function Panel(
  props: { text: string } & Omit<ComponentProps<"aside">, "text" | "style"> & {
      style?: JSX.CSSProperties;
    },
) {
  const [, others] = splitProps(props, ["text", "class"]);

  return (
    <aside class={props.class ? `panel ${props.class}` : "panel"} data-uf-48dda3f4="" {...others}>
      <p class="text" data-uf-48dda3f4="">
        {props.text}
      </p>
    </aside>
  );
}
