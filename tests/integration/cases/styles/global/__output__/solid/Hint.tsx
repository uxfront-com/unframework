import type { JSX } from "solid-js";

export default function Hint(
  props: { text: string } & { class?: string; style?: JSX.CSSProperties },
) {
  return (
    <p
      class={props.class ? `hint ${props.class}` : "hint"}
      style={props.style}
      {...scopeAttributes(props)}
    >
      Tip: <span class="uf-highlight">{props.text}</span>
    </p>
  );
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
}
