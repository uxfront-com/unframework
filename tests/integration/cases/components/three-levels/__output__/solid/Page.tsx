import Section from "./Section";
import type { JSX } from "solid-js";

export default function Page(
  props: { name: string } & { class?: string; style?: JSX.CSSProperties },
) {
  return (
    <article
      aria-label="Profile"
      class={props.class}
      style={props.style}
      {...scopeAttributes(props)}
    >
      <Section title={`About ${props.name}`} body="Three components deep." />
      <Section title="Contact" body={`Write to ${props.name}.`} />
    </article>
  );
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
}
