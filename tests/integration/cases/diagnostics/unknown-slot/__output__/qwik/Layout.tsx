import {
  type CSSProperties,
  type ClassList,
  type JSXOutput,
  type QRL,
  Slot,
  component$,
} from "@qwik.dev/core";

export interface LayoutSlots {
  title$?: QRL<() => JSXOutput>;
}

export const Layout = component$<LayoutSlots & { class?: ClassList; style?: CSSProperties }>(
  ({ title$, class: className, style, ...attributes }) => {
    return (
      <main {...scopeAttributes(attributes)} class={className} style={style}>
        <h1>{title$?.()}</h1>
        <Slot />
      </main>
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
