import type { JSX } from "@solidjs/web";

export function Card(props: { heading: string } & { class?: string; style?: JSX.CSSProperties }) {
  return (
    <section
      class={props.class ? `card ${props.class}` : "card"}
      style={props.style}
      {...scopeAttributes(props)}
    >
      <h2>{props.heading}</h2>
    </section>
  );
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
}
