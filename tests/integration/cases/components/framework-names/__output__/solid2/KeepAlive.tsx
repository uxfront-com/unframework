import type { ComponentProps, JSX } from "@solidjs/web";
import { Show, omit } from "solid-js";

export default function KeepAlive(
  props: { level: number } & Omit<ComponentProps<"div">, "level" | "class" | "style"> & {
      class?: string;
      style?: JSX.CSSProperties;
    },
) {
  const others = omit(props, "level", "class");

  return (
    <div class={props.class ? `level ${props.class}` : "level"} {...others}>
      <span>Level {props.level}</span>
      <Show when={props.level > 0}>
        <KeepAlive level={props.level - 1} />
      </Show>
    </div>
  );
}
