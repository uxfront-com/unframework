import { type JSX, Show } from "solid-js";

export default function KeepAlive(
  props: { level: number } & { class?: string; style?: JSX.CSSProperties },
) {
  return (
    <div
      class={props.class ? `level ${props.class}` : "level"}
      style={props.style}
      {...scopeAttributes(props)}
    >
      <span>Level {props.level}</span>
      <Show when={props.level > 0}>
        <KeepAlive level={props.level - 1} />
      </Show>
    </div>
  );
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
}
