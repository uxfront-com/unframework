import {
  type CSSProperties,
  type ClassList,
  type JSXOutput,
  type QRL,
  component$,
} from "@qwik.dev/core";

export interface ListSlots {
  item$?: QRL<(props: { item: string }) => JSXOutput>;
}

export default component$<
  { items: string[] } & ListSlots & { class?: ClassList; style?: CSSProperties }
>(({ items, item$, class: className, style, ...attributes }) => {
  return (
    <ol {...scopeAttributes(attributes)} class={className} style={style}>
      {items.map((item) => (
        <li key={item}>{item$?.({ item })}</li>
      ))}
    </ol>
  );
});

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const key of Object.keys(props)) {
    if (key.startsWith("data-uf-")) scope[key] = "";
  }
  return scope;
}
