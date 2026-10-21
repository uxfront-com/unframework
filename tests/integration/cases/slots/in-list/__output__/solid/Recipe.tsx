import Steps from "./Steps";
import type { JSX } from "solid-js";

export default function Recipe(
  props: { steps: string[] } & { class?: string; style?: JSX.CSSProperties },
) {
  return (
    <div class={props.class} style={props.style} {...scopeAttributes(props)}>
      <Steps steps={props.steps} marker={<span aria-hidden="true">&gt; </span>} />
    </div>
  );
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
}
