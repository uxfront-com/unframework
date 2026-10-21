import type { JSX } from "solid-js";

export default function Base(
  props: { text: string } & { class?: string; style?: JSX.CSSProperties },
) {
  return (
    <button
      type="button"
      class={props.class ? `base ${props.class}` : "base"}
      style={props.style}
      {...scopeAttributes(props)}
    >
      {props.text}
    </button>
  );
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
}
