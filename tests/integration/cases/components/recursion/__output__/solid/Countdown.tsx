import { type JSX, Show } from "solid-js";

export default function Countdown(
  props: { from: number } & { class?: string; style?: JSX.CSSProperties },
) {
  return (
    <div class={props.class ? `level ${props.class}` : "level"} style={props.style}>
      <span>{props.from}</span>
      <Show when={props.from > 0} fallback={<strong>Liftoff</strong>}>
        <Countdown from={props.from - 1} />
      </Show>
    </div>
  );
}
