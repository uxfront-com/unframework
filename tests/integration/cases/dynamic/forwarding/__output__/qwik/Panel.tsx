import {
  type CSSProperties,
  type ClassList,
  type JSXOutput,
  type QRL,
  component$,
} from "@qwik.dev/core";

export interface PanelSlots {
  title$?: QRL<() => JSXOutput>;
}

export default component$<PanelSlots & { class?: ClassList; style?: CSSProperties }>(
  ({ title$, class: className, style, ...attributes }) => {
    return (
      <div class={["panel", className]} {...scopeAttributes(attributes)} style={style}>
        <h4>{title$?.() ?? "Untitled"}</h4>
      </div>
    );
  },
);

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const key of Object.keys(props)) {
    if (key.startsWith("data-uf-")) scope[key] = "";
  }
  return scope;
}
