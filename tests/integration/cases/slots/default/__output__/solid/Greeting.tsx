import Panel from "./Panel";
import type { JSX } from "solid-js";

export default function Greeting(
  props: { name: string } & { class?: string; style?: JSX.CSSProperties },
) {
  return (
    <Panel title="Welcome" class={props.class} style={props.style} {...scopeAttributes(props)}>
      <p>
        Hello, <strong>{props.name}</strong>!
      </p>
      <p>Your children render in the panel.</p>
    </Panel>
  );
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
}
