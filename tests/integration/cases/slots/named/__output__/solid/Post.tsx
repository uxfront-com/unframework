import Card from "./Card";
import type { JSX } from "solid-js";

export default function Post(
  props: { author: string } & { class?: string; style?: JSX.CSSProperties },
) {
  return (
    <Card
      header={<h2>Release notes</h2>}
      footer={<small>By {props.author}</small>}
      class={props.class}
      style={props.style}
      {...scopeAttributes(props)}
    >
      <p>Slots arrive in M3.</p>
    </Card>
  );
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
}
