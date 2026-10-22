import type { JSX } from "solid-js";
import "./Card.uf.tsx.css";

export default function Card(
  props: { title: string } & { class?: string; style?: JSX.CSSProperties },
) {
  return (
    <section
      class={props.class ? `card ${props.class}` : "card"}
      data-uf-bb60e985=""
      style={props.style}
      {...scopeAttributes(props)}
    >
      <h2 class="title" data-uf-bb60e985="">
        {props.title}
      </h2>
    </section>
  );
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
}
