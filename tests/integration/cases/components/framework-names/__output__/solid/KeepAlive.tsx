import { type ComponentProps, type JSX, Show, splitProps } from "solid-js";

export default function KeepAlive(
  props: { level: number } & Omit<ComponentProps<"div">, "level" | "style"> & {
      style?: JSX.CSSProperties;
    },
) {
  const [, others] = splitProps(props, ["level", "class"]);

  return (
    <div class={props.class ? `level ${props.class}` : "level"} {...others}>
      <span>Level {props.level}</span>
      <Show when={props.level > 0}>
        <KeepAlive level={props.level - 1} />
      </Show>
    </div>
  );
}
