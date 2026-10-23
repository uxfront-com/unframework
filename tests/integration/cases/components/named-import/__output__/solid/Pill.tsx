import type { JSX } from "solid-js";

export function Pill(props: { text: string } & { class?: string; style?: JSX.CSSProperties }) {
  return (
    <span
      class={props.class ? `pill ${props.class}` : "pill"}
      style={props.style}
      {...scopeAttributes_1(props)}
    >
      {props.text}
    </span>
  );
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes_1(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
}
