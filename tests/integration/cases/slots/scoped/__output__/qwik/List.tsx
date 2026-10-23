import {
  type CSSProperties,
  type ClassList,
  type JSXOutput,
  type QRL,
  component$,
} from "@qwik.dev/core";

export interface ListSlots {
  item$?: QRL<(props: { item: string; index: number }) => JSXOutput>;
}

export default component$<
  { items: string[]; label: string } & ListSlots & { class?: ClassList; style?: CSSProperties }
>(({ items, label, item$, class: className, style, ...attributes }) => {
  return (
    <ul aria-label={label} {...scopeAttributes(attributes)} class={className} style={style}>
      {items.map((item, index) => (
        <li key={item}>{item$?.({ item, index })}</li>
      ))}
    </ul>
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
