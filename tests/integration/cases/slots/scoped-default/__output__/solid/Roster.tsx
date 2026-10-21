import Names from "./Names";
import type { JSX } from "solid-js";

export default function Roster(
  props: { names: string[] } & { class?: string; style?: JSX.CSSProperties },
) {
  return (
    <Names
      names={props.names}
      children={({ item }) => <b>{item}!</b>}
      class={props.class}
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
