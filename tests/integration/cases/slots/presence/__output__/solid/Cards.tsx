import Card from "./Card";
import type { JSX } from "solid-js";

export default function Cards(props: { class?: string; style?: JSX.CSSProperties }) {
  return (
    <div
      class={props.class ? `cards ${props.class}` : "cards"}
      style={props.style}
      {...scopeAttributes(props)}
    >
      <Card label="Full" title={<h3>Weather</h3>}>
        <p>Sunny, 21°</p>
      </Card>
      <Card label="Bare" />
    </div>
  );
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
}
