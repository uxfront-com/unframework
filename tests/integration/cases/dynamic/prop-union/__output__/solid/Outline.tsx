import Heading from "./Heading";
import type { JSX } from "solid-js";

export default function Outline(props: { class?: string; style?: JSX.CSSProperties }) {
  return (
    <main class={props.class} style={props.style} {...scopeAttributes(props)}>
      <Heading tag="h1" text="Guide" />
      <Heading tag="h2" text="Setup" />
      <Heading tag="h3" text="Requirements" />
    </main>
  );
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
}
