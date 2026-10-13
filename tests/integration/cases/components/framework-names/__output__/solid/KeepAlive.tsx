import { type JSX, Show } from "solid-js";

export default function KeepAlive(
  props: { level: number } & { class?: string; style?: JSX.CSSProperties },
) {
  return (
    <div class={props.class ? `level ${props.class}` : "level"} style={props.style}>
      <span>Level {props.level}</span>
      <Show when={props.level > 0}>
        <KeepAlive level={props.level - 1} />
      </Show>
    </div>
  );
}
