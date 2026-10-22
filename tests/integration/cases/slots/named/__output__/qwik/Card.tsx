import {
  type CSSProperties,
  type ClassList,
  type JSXOutput,
  type QRL,
  Slot,
  component$,
} from "@qwik.dev/core";

export interface CardSlots {
  header$?: QRL<() => JSXOutput>;
  footer$?: QRL<() => JSXOutput>;
}

export default component$<CardSlots & { class?: ClassList; style?: CSSProperties }>(
  ({ header$, footer$, class: className, style, ...attributes }) => {
    return (
      <article class={["card", className]} {...scopeAttributes(attributes)} style={style}>
        <header>{header$?.()}</header>
        <div class="body">
          <Slot />
        </div>
        <footer>{footer$?.()}</footer>
      </article>
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
