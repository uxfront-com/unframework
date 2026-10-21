import type { JSX } from "solid-js";

export interface LayoutSlots {
  title?: JSX.Element;
  children?: JSX.Element;
}

export function Layout(props: LayoutSlots & { class?: string; style?: JSX.CSSProperties }) {
  return (
    <main class={props.class} style={props.style} {...scopeAttributes(props)}>
      <h1>{props.title}</h1>
      {props.children}
    </main>
  );
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
}
