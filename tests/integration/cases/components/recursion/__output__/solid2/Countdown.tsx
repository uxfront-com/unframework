import type { ComponentProps, JSX } from "@solidjs/web";
import { Show, omit } from "solid-js";

export default function Countdown(
  props: { from: number } & Omit<ComponentProps<"div">, "from" | "class" | "style"> & {
      class?: string;
      style?: JSX.CSSProperties;
    },
) {
  const others = omit(props, "from", "class");

  return (
    <div class={props.class ? `level ${props.class}` : "level"} {...others}>
      <span>{props.from}</span>
      <Show when={props.from > 0} fallback={<strong>Liftoff</strong>}>
        <Countdown from={props.from - 1} />
      </Show>
    </div>
  );
}
