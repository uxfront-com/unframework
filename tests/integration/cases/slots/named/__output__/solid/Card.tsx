import type { JSX } from "solid-js";

export interface CardSlots {
  header?: JSX.Element;
  children?: JSX.Element;
  footer?: JSX.Element;
}

export default function Card(props: CardSlots & { class?: string; style?: JSX.CSSProperties }) {
  return (
    <article
      class={props.class ? `card ${props.class}` : "card"}
      style={props.style}
      {...scopeAttributes(props)}
    >
      <header>{props.header}</header>
      <div class="body">{props.children}</div>
      <footer>{props.footer}</footer>
    </article>
  );
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
}
