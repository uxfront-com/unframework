import type { JSX } from "solid-js";

export interface PanelSlots {
  children?: JSX.Element;
}

export default function Panel(
  props: { title: string } & PanelSlots & { class?: string; style?: JSX.CSSProperties },
) {
  return (
    <section
      class={props.class ? `panel ${props.class}` : "panel"}
      aria-label={props.title}
      style={props.style}
      {...scopeAttributes(props)}
    >
      <h2>{props.title}</h2>
      {props.children}
    </section>
  );
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
}
