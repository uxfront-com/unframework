import Heading from "./Heading";
import type { JSX } from "solid-js";

export default function Section(
  props: { title: string; body: string } & { class?: string; style?: JSX.CSSProperties },
) {
  return (
    <section
      class={props.class ? `section ${props.class}` : "section"}
      style={props.style}
      {...scopeAttributes(props)}
    >
      <Heading text={props.title} />
      <p>{props.body}</p>
    </section>
  );
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
}
