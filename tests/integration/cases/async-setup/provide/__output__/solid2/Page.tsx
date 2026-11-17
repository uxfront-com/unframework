import Badge from "./Badge";
import Panel from "./Panel";
import type { JSX } from "@solidjs/web";

export default function Page(props: { class?: string; style?: JSX.CSSProperties }) {
  return (
    <main class={props.class} style={props.style} {...scopeAttributes(props)}>
      <Panel id="ada">
        <Badge />
      </Panel>
    </main>
  );
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
}
