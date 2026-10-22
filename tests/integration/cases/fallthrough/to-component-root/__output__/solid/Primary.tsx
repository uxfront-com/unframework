import Base from "./Base";
import type { JSX } from "solid-js";

export default function Primary(
  props: { text: string } & { class?: string; style?: JSX.CSSProperties },
) {
  return (
    <Base
      text={props.text}
      class={props.class ? `primary ${props.class}` : "primary"}
      style={props.style}
      {...scopeAttributes(props)}
    />
  );
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
}
