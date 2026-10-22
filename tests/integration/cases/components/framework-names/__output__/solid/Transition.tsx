import type { JSX } from "solid-js";

export default function Transition(
  props: { step: string } & { class?: string; style?: JSX.CSSProperties },
) {
  return (
    <p
      class={props.class ? `step ${props.class}` : "step"}
      style={props.style}
      {...scopeAttributes(props)}
    >
      Step: {props.step}
    </p>
  );
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
}
