import { type ComponentProps, type JSX, Show, splitProps } from "solid-js";

export default function Countdown(
  props: { from: number } & Omit<ComponentProps<"div">, "from" | "style"> & {
      style?: JSX.CSSProperties;
    },
) {
  const [, others] = splitProps(props, ["from", "class"]);

  return (
    <div class={props.class ? `level ${props.class}` : "level"} {...others}>
      <span>{props.from}</span>
      <Show when={props.from > 0} fallback={<strong>Liftoff</strong>}>
        <Countdown from={props.from - 1} />
      </Show>
    </div>
  );
}
